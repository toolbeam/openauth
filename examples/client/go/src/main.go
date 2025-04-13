package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"

	"github.com/aws/aws-lambda-go/lambda"
	"github.com/awslabs/aws-lambda-go-api-proxy/httpadapter"
	"github.com/sst/sst/v3/sdk/golang/resource"
	"github.com/toolbeam/openauth/client"
	"github.com/toolbeam/openauth/subject"
)

func getOrigin(u *url.URL) string {
	return fmt.Sprintf("%s://%s", u.Scheme, u.Host)
}

type UserSubject struct {
	Id string `json:"id"`
}

func main() {

	authUrl, err := resource.Get("Auth", "url")
	if err != nil {
		panic(err)
	}
	var authUrlString string
	authUrlString = authUrl.(string)
	if authUrlString == "" {
		panic("authUrl is empty")
	}

	// setup the openauth client
	authClient, err := client.NewClient(client.ClientInput{
		ClientID: "lambda-api-go",
		Issuer:   authUrlString,
		SubjectSchema: subject.SubjectSchemas{
			"user": func(properties any) (any, error) {
				user, ok := properties.(map[string]any)
				if !ok {
					return nil, errors.New("invalid user type")
				}
				if user["id"] == nil {
					return nil, errors.New("id is required")
				}
				// can do other validation here if there are other properties
				return UserSubject{Id: user["id"].(string)}, nil
			},
		},
	})

	if err != nil {
		panic(err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		accessCookie, err := r.Cookie("access_token")
		if err != nil {
			http.Redirect(w, r, "/authorize", http.StatusSeeOther)
			return
		}
		verified, err := authClient.Verify(accessCookie.Value, &client.VerifyOptions{})
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if verified.Tokens != nil {
			setCookies(w, verified.Tokens.Access, verified.Tokens.Refresh)
		}
		w.Header().Set("Content-Type", "application/json")
		// can do check on the type of the subject to get the correct type to cast to
		if verified.Subject.Type != "user" {
			http.Error(w, "invalid subject type", http.StatusInternalServerError)
			return
		}
		json.NewEncoder(w).Encode(verified.Subject.Properties.(UserSubject))
	})
	mux.HandleFunc("/authorize", func(w http.ResponseWriter, r *http.Request) {
		origin := getOrigin(r.URL)
		redirectURI := origin + "/callback"
		authorize, err := authClient.Authorize(redirectURI, "code", &client.AuthorizeOptions{})
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		http.Redirect(w, r, authorize.URL, http.StatusSeeOther)
	})

	mux.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
		origin := getOrigin(r.URL)
		if origin == "" {
			http.Error(w, "Origin header is required", http.StatusBadRequest)
			return
		}
		redirectURI := origin + "/callback"
		code := r.URL.Query().Get("code")
		if code == "" {
			http.Error(w, "Code is required", http.StatusBadRequest)
			return
		}
		exchanged, err := authClient.Exchange(code, redirectURI, &client.ExchangeOptions{})
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		setCookies(w, exchanged.Tokens.Access, exchanged.Tokens.Refresh)
		http.Redirect(w, r, origin, http.StatusSeeOther)
	})

	lambda.Start(httpadapter.NewV2(mux).ProxyWithContext)
}

func setCookies(w http.ResponseWriter, access, refresh string) {
	http.SetCookie(w, &http.Cookie{
		Name:     "access_token",
		Value:    access,
		MaxAge:   34560000,
		SameSite: http.SameSiteStrictMode,
		Path:     "/",
		HttpOnly: true,
	})
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    refresh,
		MaxAge:   34560000,
		SameSite: http.SameSiteStrictMode,
		Path:     "/",
		HttpOnly: true,
	})
}
