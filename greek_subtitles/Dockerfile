ARG BUILD_FROM
FROM ${BUILD_FROM}

# The released Stremio addon, unchanged: https://github.com/jfle/aio-streams-subtitles-greek/releases
ARG APP_VERSION
RUN apk add --no-cache --virtual .fetch curl tar \
 && curl -fsSL "https://github.com/jfle/aio-streams-subtitles-greek/releases/download/v${APP_VERSION}/aio-streams-subtitles-greek-${APP_VERSION}.tar.gz" | tar -xz -C /opt \
 && mv /opt/aio-streams-subtitles-greek /opt/app \
 && apk del .fetch

COPY rootfs/ha-start.js /ha-start.js
ENTRYPOINT ["node", "/ha-start.js", "subtitles"]
