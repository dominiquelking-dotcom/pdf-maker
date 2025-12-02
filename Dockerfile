FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Install dependencies using package.json
COPY package*.json ./
RUN npm install --omit=dev

# Copy project files
COPY . .

# Default port your app probably listens on
ENV PORT=8080
EXPOSE 8080

# Start pdf-maker
# If you use app.js instead, change server.js to app.js
CMD ["node", "server.js"]
