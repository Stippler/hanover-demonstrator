#!/bin/sh
set -e

PRIV_ALIAS="${EDC_TRANSFER_PROXY_TOKEN_SIGNER_PRIVATEKEY_ALIAS:-dpkey}"
PUB_ALIAS="${EDC_TRANSFER_PROXY_TOKEN_VERIFIER_PUBLICKEY_ALIAS:-dpkey-pub}"
KEYFILE="/tmp/${PRIV_ALIAS}.pem"
PUBFILE="/tmp/${PUB_ALIAS}.pem"
PROPSFILE="/tmp/vault.properties"

# Generate EC P-256 key pair
openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out "$KEYFILE" 2>/dev/null

# Extract public key
openssl pkey -in "$KEYFILE" -pubout -out "$PUBFILE" 2>/dev/null

# Write properties file: private key for signing, public key for verification
{
  printf "edc.vault.secrets.%s=" "$PRIV_ALIAS"
  awk '{printf "%s\\n", $0}' "$KEYFILE"
  printf "\n"
  printf "edc.vault.secrets.%s=" "$PUB_ALIAS"
  awk '{printf "%s\\n", $0}' "$PUBFILE"
  printf "\n"
} > "$PROPSFILE"

exec java \
  -Djava.security.egd=file:/dev/urandom \
  -Dedc.fs.config="$PROPSFILE" \
  -cp "/app/edc-dataplane.jar:/app/vault-seed.jar" \
  org.eclipse.edc.boot.system.runtime.BaseRuntime
