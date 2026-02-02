restart the server on the pi using
- sudo systemctl restart life_dashboard.service

see the status via
- sudo systemctl status life_dashboard.service

Server details on
- sudo nano /etc/systemd/system/life_dashboard.service

Run the Daemon via
- sudo systemctl daemon-reload

See log
- ssh; journalctl -u life_dashboard.service -n 50 --no-pager