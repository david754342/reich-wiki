/* Reich Wiki – Verbindung zu Supabase
   Beide Werte sind öffentlich (sie stehen in jeder Supabase-Webseite). Geschützt werden die Daten
   durch die Anmeldung und die Zugriffsregeln in der Datenbank – nicht durch diese Datei.
   Niemals den geheimen "service_role"/"secret"-Schlüssel oder den Claude-API-Schlüssel hier eintragen! */
window.REICH_WIKI_CONFIG = {
  supabaseUrl: 'https://ktgyllpfcpokieoltkvz.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0Z3lsbHBmY3Bva2llb2x0a3Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQzMTU0MjEsImV4cCI6MjEwOTg5MTQyMX0.7DDTz6bSkHDOdRt537eYab06Q55e6ZvFFXB5mVZmBLo',
  usernameDomain: 'wiki.reich-haustechnik.de'
};
