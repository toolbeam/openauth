package client

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/lestrrat-go/jwx/v3/jwk"
	"github.com/lestrrat-go/jwx/v3/jwt"
	"github.com/toolbeam/openauth/internal/util"
	"github.com/toolbeam/openauth/subject"
)

var (
	ErrInvalidAuthorizationCode = errors.New("invalid authorization code")
	ErrInvalidRefreshToken      = errors.New("invalid refresh token")
	ErrInvalidAccessToken       = errors.New("invalid access token")
	ErrInvalidSubject           = errors.New("invalid subject")
	ErrUnknownState             = errors.New("The browser was in an unknown state. This could be because certain cookies expired or the browser was switched in the middle of an authentication flow.")
)

// WellKnown is the well-known information for an OAuth 2.0 authorization server.
type WellKnown struct {
	// JWKsUri is the URI to the JWKS endpoint.
	JWKsUri string `json:"jwks_uri"`
	// TokenEndpoint is the URI to the token endpoint.
	TokenEndpoint string `json:"token_endpoint"`
	// AuthorizationEndpoint is the URI to the authorization endpoint.
	AuthorizationEndpoint string `json:"authorization_endpoint"`
}

// Tokens is the tokens returned by the auth server.
type Tokens struct {
	// Access is the access token.
	Access string `json:"access_token"`
	// Refresh is the refresh token.
	Refresh string `json:"refresh_token"`
	// ExpiresIn is the number of seconds until the access token expires.
	ExpiresIn int `json:"expires_in"`
}

// Challenge is the challenge that you can use to verify the code.
type Challenge struct {
	// State is the state that was sent to the redirect URI.
	State string
	// Verifier is the verifier that was sent to the redirect URI.
	Verifier string
}

// AuthorizeOptions is the options for the authorize endpoint.
type AuthorizeOptions struct {
	// Enable the PKCE flow. This is for SPA apps.
	PKCE bool
	// Provider is the provider to use for the OAuth flow.
	Provider string
}

// AuthorizeResult is the result of the authorize endpoint.
type AuthorizeResult struct {
	// The challenge that you can use to verify the code. This is for the PKCE flow for SPA apps.
	Challenge Challenge
	// The URL to redirect the user to. This starts the OAuth flow.
	URL string
}

// ExchangeSuccess is the success result of the exchange endpoint.
type ExchangeSuccess struct {
	Tokens Tokens
}

type RefreshOptions struct {
	// Optionally, pass in the access token.
	Access string
}

type RefreshSuccess struct {
	Tokens *Tokens
}

type VerifyOptions struct {
	// Optionally, pass in the refresh token.
	Refresh string
	// Optionally, override the internally used HTTP client.
	HTTPClient *http.Client
	// @internal
	issuer string
	// @internal
	audience string
}

type VerifyResult struct {
	Tokens *Tokens
	// @internal
	aud     string
	Subject *Subject
}

type Subject struct {
	ID         string
	Type       string
	Properties any
}

type ExchangeOptions struct {
	Verifier string
}

type DecodeSuccess struct {
	Subject *Subject
}

type ClientInput struct {
	// The client ID. This is just a string to identify your app.
	ClientID string
	// The URL of your OpenAuth server.
	Issuer     string
	httpClient *http.Client
	// The schema of the subject.
	SubjectSchema subject.SubjectSchemas
}

type Client struct {
	clientID      string
	issuer        string
	httpClient    *http.Client
	issuerCache   map[string]WellKnown
	jwksCache     map[string]jwk.Set
	mu            sync.RWMutex
	subjectSchema *subject.SubjectSchemas
}

func NewClient(input ClientInput) (*Client, error) {
	httpClient := input.httpClient
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	if input.Issuer == "" {
		input.Issuer = os.Getenv("OPENAUTH_ISSUER")
	}
	if input.Issuer == "" {
		return nil, errors.New("issuer is required")
	}
	return &Client{
		clientID:      input.ClientID,
		issuer:        input.Issuer,
		httpClient:    httpClient,
		issuerCache:   map[string]WellKnown{},
		jwksCache:     map[string]jwk.Set{},
		mu:            sync.RWMutex{},
		subjectSchema: &input.SubjectSchema,
	}, nil
}

// getIssuer fetches the well-known configuration from the issuer URL and caches it.
func (c *Client) getIssuer() (WellKnown, error) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if cached, ok := c.issuerCache[c.issuer]; ok {
		return cached, nil
	}
	resp, err := c.httpClient.Get(fmt.Sprintf("%s/.well-known/oauth-authorization-server", c.issuer))
	if err != nil {
		return WellKnown{}, fmt.Errorf("failed to fetch well-known config: %w", err)
	}
	defer resp.Body.Close()
	var config WellKnown
	if err := json.NewDecoder(resp.Body).Decode(&config); err != nil {
		return WellKnown{}, fmt.Errorf("failed to decode well-known config: %w", err)
	}
	c.issuerCache[c.issuer] = config
	return config, nil
}

// getJWKS fetches the JWKS from the issuer URL and caches it.
func (c *Client) getJWKS() (jwk.Set, error) {
	wellKnown, err := c.getIssuer()
	if err != nil {
		return nil, fmt.Errorf("failed to get well-known config: %w", err)
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if cached, ok := c.jwksCache[wellKnown.JWKsUri]; ok {
		return cached, nil
	}
	set, err := jwk.Fetch(context.Background(), wellKnown.JWKsUri)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch JWKS: %w", err)
	}
	c.jwksCache[wellKnown.JWKsUri] = set
	return set, nil
}

// Start the authorization flow.
//
// This takes a redirect URI and the type of flow you want to use. The redirect URI is the
// location where the user will be redirected after the flow is complete.
//
// Supports both the `code` and `token` flows. We recommend using the `code` flow as it's
// more secure.
//
// For SPA apps, we recommend using the PKCE flow.
//
//	result, err := client.Authorize(redirectURI, "code", &AuthorizeOptions{
//	  PKCE: true,
//	})
//
// This returns a redirect URL and a challenge that you can use to verify the code.
func (c *Client) Authorize(redirectURI string, response string, opts *AuthorizeOptions) (*AuthorizeResult, error) {
	result := &AuthorizeResult{}
	u, err := url.Parse(c.issuer)
	if err != nil {
		return nil, fmt.Errorf("failed to parse issuer: %w", err)
	}
	u.Path = "/authorize"
	result.Challenge.State = uuid.New().String()
	query := url.Values{
		"client_id":     {c.clientID},
		"redirect_uri":  {redirectURI},
		"response_type": {response},
		"state":         {result.Challenge.State},
	}
	if opts != nil && opts.Provider != "" {
		query.Set("provider", opts.Provider)
	}
	if opts != nil && opts.PKCE && response == "code" {
		verifier, challenge, method, err := util.GeneratePKCE()
		if err != nil {
			return nil, fmt.Errorf("failed to generate PKCE: %w", err)
		}
		query.Set("code_challenge_method", method)
		query.Set("code_challenge", challenge)
		result.Challenge.Verifier = verifier
	}
	u.RawQuery = query.Encode()
	result.URL = u.String()
	return result, nil
}

// Exchange the code for access and refresh tokens.
//
// You call this after the user has been redirected back to your app after the OAuth flow.
//
// For SSR sites, the code is returned in the query parameter.
//
//	result, err := client.Exchange(code, redirectURI)
//
// For SPA sites, the code is returned as a part of the redirect URL hash.
//
//	result, err := client.Exchange(code, redirectURI, &ExchangeOptions{
//	  Verifier: verifier,
//	})
//
// This returns the access and refresh tokens. Or if it fails, it returns an error that
// you can handle depending on the error.
//
//	if err != nil {
//	  if errors.Is(err, ErrInvalidAuthorizationCode) {
//	    // handle invalid code error
//	  } else {
//	    // handle other errors
//	  }
//	}
func (c *Client) Exchange(code string, redirectURI string, opts *ExchangeOptions) (*ExchangeSuccess, error) {
	endpoint := c.issuer + "/token"
	data := url.Values{}
	data.Set("code", code)
	data.Set("redirect_uri", redirectURI)
	data.Set("grant_type", "authorization_code")
	data.Set("client_id", c.clientID)
	if opts != nil && opts.Verifier != "" {
		data.Set("code_verifier", opts.Verifier)
	}
	req, err := http.NewRequest("POST", endpoint, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		fmt.Printf("resp: %+v\n", resp.StatusCode)
		return nil, ErrInvalidAuthorizationCode
	}

	var tokens Tokens
	if err := json.NewDecoder(resp.Body).Decode(&tokens); err != nil {
		return nil, fmt.Errorf("failed to decode tokens: %w", err)
	}

	return &ExchangeSuccess{Tokens: tokens}, nil
}

// Refresh implements the token if they have expires. This is used in an SPA app to maintain the
// session, without logging the user out.
//
//	result, err := client.Refresh(refreshToken, &RefreshOptions{})
//
// Can optionally take the access token as well. If passed in, this will skip the refresh
// if the access token is still valid.
//
//	result, err := client.Refresh(refreshToken, &RefreshOptions{
//	  Access: accessToken,
//	})
//
// This returns the refreshed tokens only if they've been refreshed.
//
//	if result.Tokens != nil {
//	  // tokens are refreshed
//	}
//
// Or if it fails, it returns an error that you can handle depending on the error.
//
//	if err != nil {
//	  if errors.Is(err, ErrInvalidRefreshToken) {
//	    // handle invalid refresh token error
//	  } else {
//	    // handle other errors
//	  }
//	}
func (c *Client) Refresh(refreshToken string, opts *RefreshOptions) (*RefreshSuccess, error) {
	if opts != nil && opts.Access != "" {
		parsed, err := jwt.ParseInsecure([]byte(opts.Access))
		if err != nil {
			return nil, ErrInvalidAccessToken
		}
		exp, ok := parsed.Expiration()
		if ok && exp.After(time.Now().Add(time.Second*30)) {
			return &RefreshSuccess{}, nil
		}
	}

	issuerEndpoint := c.issuer + "/token"
	data := url.Values{}
	data.Set("grant_type", "refresh_token")
	data.Set("refresh_token", refreshToken)

	req, err := http.NewRequest("POST", issuerEndpoint, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, ErrInvalidRefreshToken
	}

	var tokens Tokens
	if err := json.NewDecoder(resp.Body).Decode(&tokens); err != nil {
		return nil, ErrInvalidRefreshToken
	}

	return &RefreshSuccess{Tokens: &tokens}, nil
}

// Verify the token in the incoming request.
//
// This is typically used for SSR sites where the token is stored in an HTTP only cookie. And
// is passed to the server on every request.
//
//	result, err := client.Verify(token, &VerifyOptions{})
//
// This optionally takes the refresh token as well. If passed in, it'll automatically
// refresh the access token if it has expired.
//
//	result, err := client.Verify(token, &VerifyOptions{
//	  Refresh: refreshToken,
//	})
//
// This returns the decoded subjects from the access token. And the tokens if they've been
// refreshed.
//
//	if result.Tokens != nil {
//	  // tokens are refreshed
//	}
//
// Or if it fails, it returns an error that you can handle depending on the error.
//
//	if err != nil {
//	  if errors.Is(err, ErrInvalidRefreshToken) {
//	    // handle invalid refresh token error
//	  } else {
//	    // handle other errors
//	  }
//	}
func (c *Client) Verify(token string, options *VerifyOptions) (*VerifyResult, error) {
	jwks, err := c.getJWKS()
	if err != nil {
		return nil, fmt.Errorf("failed to get JWKS: %w", err)
	}

	var opts []jwt.ParseOption
	opts = append(opts, jwt.WithKeySet(jwks))
	if options.issuer != "" {
		opts = append(opts, jwt.WithIssuer(options.issuer))
	}
	if options.audience != "" {
		opts = append(opts, jwt.WithAudience(options.audience))
	}

	parsed, err := jwt.ParseString(token, opts...)
	if err != nil {
		// Check if token is expired and we have a refresh token
		if options.Refresh != "" && errors.Is(err, jwt.TokenExpiredError()) {
			refreshed, err := c.Refresh(options.Refresh, &RefreshOptions{})
			if err != nil {
				return nil, fmt.Errorf("failed to refresh token: %w", err)
			}
			if refreshed.Tokens == nil {
				panic("should have tokens when refreshing without access token")
			}

			// Recursively verify the new token
			verified, err := c.Verify(refreshed.Tokens.Access, &VerifyOptions{
				Refresh:  refreshed.Tokens.Refresh,
				issuer:   options.issuer,
				audience: options.audience,
			})
			if err != nil {
				return nil, fmt.Errorf("failed to verify refreshed token: %w", err)
			}
			verified.Tokens = refreshed.Tokens
			return verified, nil
		}
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	// Get standard claims
	sub, ok := parsed.Subject()
	if !ok || sub == "" {
		return nil, errors.New("missing subject")
	}

	audiences, ok := parsed.Audience()
	if !ok || len(audiences) == 0 {
		return nil, errors.New("missing audience")
	}

	// Get private claims
	var mode interface{}
	if err := parsed.Get("mode", &mode); err != nil {
		return nil, errors.New("missing mode claim")
	}
	modeStr, ok := mode.(string)
	if !ok || modeStr != "access" {
		return nil, errors.New("invalid token mode")
	}

	var typ interface{}
	if err := parsed.Get("type", &typ); err != nil {
		return nil, errors.New("missing type claim")
	}
	typeStr, ok := typ.(string)
	if !ok {
		return nil, errors.New("invalid type format")
	}

	var props interface{}
	if err := parsed.Get("properties", &props); err != nil {
		return nil, errors.New("missing properties")
	}
	validator, ok := (*c.subjectSchema)[typeStr]
	if !ok {
		return nil, errors.New("missing validator for type")
	}
	properties, err := validator(props)
	if err != nil {
		return nil, err
	}

	return &VerifyResult{
		Tokens: nil, // Only set if token was refreshed
		aud:    audiences[0],
		Subject: &Subject{
			ID:         sub,
			Type:       typeStr,
			Properties: properties,
		},
	}, nil
}

// Decode a JWT token without verifying its signature.
//
// This is typically used for SSR sites where the token is stored in an HTTP only cookie. And
// is passed to the server on every request.
//
//	result, err := client.Decode(token)
//
// This returns the decoded token's subject if successful.
//
//	if err != nil {
//	  // handle error
//	}
func (c *Client) Decode(token string) (*DecodeSuccess, error) {
	parsed, err := jwt.ParseInsecure([]byte(token))
	if err != nil {
		return nil, ErrInvalidAccessToken
	}

	sub, ok := parsed.Subject()
	if !ok || sub == "" {
		return nil, ErrInvalidAccessToken
	}

	var typ interface{}
	if err := parsed.Get("type", &typ); err != nil {
		return nil, ErrInvalidAccessToken
	}
	typeStr, ok := typ.(string)
	if !ok {
		return nil, ErrInvalidAccessToken
	}

	var props interface{}
	if err := parsed.Get("properties", &props); err != nil {
		return nil, ErrInvalidAccessToken
	}
	validator, ok := (*c.subjectSchema)[typeStr]
	if !ok {
		return nil, errors.New("missing validator for type")
	}
	properties, err := validator(props)
	if err != nil {
		return nil, err
	}

	return &DecodeSuccess{
		Subject: &Subject{ID: sub, Type: typeStr, Properties: properties},
	}, nil
}
