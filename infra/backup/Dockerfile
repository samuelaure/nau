FROM alpine:3.19

RUN apk add --no-cache \
    postgresql16-client \
    rclone \
    supercronic \
    curl \
    age \
    tzdata

COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh

# Dumps land here. Mount a host volume so they survive container recreation —
# the previous image wrote to /tmp, where a rebuild would have destroyed the
# only copies that existed while R2 uploads were failing.
VOLUME ["/backups"]

# Run at 02:00 UTC daily
RUN echo "0 2 * * * /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1" \
    > /etc/crontab

# Reports unhealthy if the last run failed or has not happened in over 48h, so a
# silently broken backup surfaces in `docker ps` instead of only in a log.
HEALTHCHECK --interval=1h --timeout=10s --start-period=5m \
  CMD grep -q '^OK' /backups/LAST_RUN 2>/dev/null \
   && [ -z "$(find /backups/LAST_RUN -mmin +2880 2>/dev/null)" ] \
   || exit 1

CMD ["supercronic", "/etc/crontab"]
