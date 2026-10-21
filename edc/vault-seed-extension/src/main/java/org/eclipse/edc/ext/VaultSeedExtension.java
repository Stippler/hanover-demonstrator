package org.eclipse.edc.ext;

import org.eclipse.edc.runtime.metamodel.annotation.Inject;
import org.eclipse.edc.spi.security.Vault;
import org.eclipse.edc.spi.system.ServiceExtension;
import org.eclipse.edc.spi.system.ServiceExtensionContext;

/**
 * Seeds the InMemoryVault with signing (private) and verification (public) keys
 * from config properties. Reads edc.vault.secrets.{alias} for each key alias.
 */
public class VaultSeedExtension implements ServiceExtension {

    @Inject
    private Vault vault;

    @Override
    public String name() {
        return "Vault Seed Extension";
    }

    @Override
    public void initialize(ServiceExtensionContext context) {
        seedKey(context, "edc.transfer.proxy.token.signer.privatekey.alias");
        seedKey(context, "edc.transfer.proxy.token.verifier.publickey.alias");
    }

    private void seedKey(ServiceExtensionContext context, String aliasProperty) {
        String alias = context.getSetting(aliasProperty, null);
        if (alias == null) {
            context.getMonitor().warning("VaultSeed: no alias for " + aliasProperty);
            return;
        }
        String pem = context.getSetting("edc.vault.secrets." + alias, null);
        if (pem != null) {
            String resolved = pem.replace("\\n", "\n");
            vault.storeSecret(alias, resolved);
            context.getMonitor().info("VaultSeed: stored key '" + alias + "' (" + resolved.length() + " chars)");
        } else {
            context.getMonitor().warning("VaultSeed: no secret for alias '" + alias + "'");
        }
    }
}
