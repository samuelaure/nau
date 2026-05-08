FROM alpine:3.19

RUN apk add --no-cache \
    postgresql16-client \
    rclone \
    supercronic \
    tzdata

COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh

# Run at 02:00 UTC daily
RUN echo "0 2 * * * /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1" \
    > /etc/crontab

CMD ["supercronic", "/etc/crontab"]
