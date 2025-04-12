module example-client-go

go 1.23.5

require (
	github.com/aws/aws-lambda-go v1.48.0
	github.com/awslabs/aws-lambda-go-api-proxy v0.16.2
	github.com/sst/sst/v3 v3.13.10
	github.com/toolbeam/openauth v0.0.0
)

require (
	github.com/decred/dcrd/dcrec/secp256k1/v4 v4.4.0 // indirect
	github.com/goccy/go-json v0.10.3 // indirect
	github.com/google/uuid v1.6.0 // indirect
	github.com/lestrrat-go/blackmagic v1.0.2 // indirect
	github.com/lestrrat-go/httpcc v1.0.1 // indirect
	github.com/lestrrat-go/httprc/v3 v3.0.0-beta1 // indirect
	github.com/lestrrat-go/jwx/v3 v3.0.0 // indirect
	github.com/lestrrat-go/option v1.0.1 // indirect
	github.com/segmentio/asm v1.2.0 // indirect
	golang.org/x/crypto v0.36.0 // indirect
	golang.org/x/sys v0.31.0 // indirect
)

replace github.com/toolbeam/openauth => ../../../../packages/openauth-go
