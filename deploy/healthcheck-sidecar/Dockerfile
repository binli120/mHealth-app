FROM node:22-alpine
WORKDIR /app
COPY index.js .
# Run as non-root — node:22-alpine ships a built-in 'node' user (uid 1000)
USER node
CMD ["node", "index.js"]
