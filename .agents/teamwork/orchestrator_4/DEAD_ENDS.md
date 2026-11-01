# Dead Ends Log

| Iteration | Approach Tried | Why It Failed | Files Touched |
|-----------|---------------|---------------|---------------|
| M4 Iter 1 | Custom/manually typed 2,048-word dictionary omitting 'employ', 'gospel', 'ride' and adding 'ladle', 'offline' | Corrupted canonical BIP-39 SHA-256 (481f... vs 2f5e...), shifted indices for 1,465 words, failed canonical SatoshiLabs test vectors | src/services/security/bip39Wordlist.ts, tests/security/master_recovery_bip39.test.ts |
