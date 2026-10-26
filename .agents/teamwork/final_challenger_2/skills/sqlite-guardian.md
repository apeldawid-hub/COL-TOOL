# Dump of sqlite-guardian
Opiekun bazy danych SQLite, integralności danych i bezpieczeństwa platformy. Zarządza defragmentacją VACUUM, automatycznymi kopiami zapasowymi (rotacja 15 kopii), diagnostyką PRAGMA, migracjami tabel bez utraty danych oraz fizyczną separacją baz kawiarni (Multi-Store Isolation).
Lokalizacja bazy: ~/Library/Application Support/Starbucks Operations Suite/
Pliki: store_${storeId}.db
Rotacja kopii: 15 kopii zapasowych
Integralność: PRAGMA integrity_check, quick_check
