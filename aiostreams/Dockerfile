ARG BUILD_FROM
FROM ${BUILD_FROM}

# The official AIOStreams image is distroless (Node only, no shell tools): the launcher is plain Node too.
COPY rootfs/ha-start.js /ha-start.js
ENTRYPOINT ["/nodejs/bin/node", "/ha-start.js", "aiostreams"]
CMD []
