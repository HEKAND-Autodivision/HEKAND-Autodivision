HEKAND AUTO DIVISION v12 - CENTRAL DATABASE

This package converts the v11 browser app into an online-ready full-stack application.
The Node.js server serves the app and stores the shared application state centrally in data/hekand-db.json.
All authenticated devices use the same central state.

LOCAL TEST
1. Install Node.js 18+ on the PC/server.
2. Open Command Prompt in this folder.
3. Run: npm start
4. Open: http://localhost:8080
5. Default login: owner / owner123 OR admin / admin123
6. Change the default passwords immediately.

LAN / OFFICE USE
- Run the server on one PC that stays on.
- Find that PC's LAN IP, e.g. 192.168.1.50.
- On other devices open http://192.168.1.50:8080
- Allow Node.js through Windows Firewall for the selected port.

INTERNET / CLOUD USE
- Deploy this folder to a Node.js hosting/VPS service.
- Use HTTPS in production.
- Restrict the data directory and back up data/hekand-db.json regularly.
- Do NOT expose port 8080 directly to the public internet without HTTPS/reverse proxy/security controls.

IMPORTANT
The included central database is a server-side JSON database for easy deployment and portability.
For a larger multi-user production workload, migrate the same API to PostgreSQL/MySQL/Supabase.
The browser keeps a local cache only as a fallback; the authoritative shared data is on the server.
