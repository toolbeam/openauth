package util

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
)

const (
	PKCEMethodS256    = "S256"
	PKCEMethodPlain   = "plain"
	PKCEDefaultLength = 64
)

func generateVerifier(length int) (string, error) {
	buffer := make([]byte, length)
	_, err := rand.Read(buffer)
	if err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(buffer), nil
}

func generateChallenge(verifier, method string) (string, error) {
	if method == PKCEMethodPlain {
		return verifier, nil
	}
	hasher := sha256.New()
	hasher.Write([]byte(verifier))
	hash := hasher.Sum(nil)
	return base64.URLEncoding.EncodeToString(hash), nil
}

func GeneratePKCE(length ...int) (verifier, challenge, method string, err error) {
	l := PKCEDefaultLength
	if len(length) > 0 {
		l = length[0]
	}
	if l < 43 || l > 128 {
		return "", "", "", errors.New("code verifier length must be between 43 and 128 characters")
	}
	verifier, err = generateVerifier(l)
	if err != nil {
		return "", "", "", err
	}
	challenge, err = generateChallenge(verifier, PKCEMethodS256)
	if err != nil {
		return "", "", "", err
	}
	return verifier, challenge, PKCEMethodS256, nil
}

func ValidatePKCE(verifier, challenge, method string) (bool, error) {
	generatedChallenge, err := generateChallenge(verifier, method)
	if err != nil {
		return false, err
	}
	return generatedChallenge == challenge, nil
}
