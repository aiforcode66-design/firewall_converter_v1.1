
FROM node:22-alpine

WORKDIR /app

# Copy package.json and package-lock.json
# We assume build context is "frontend_src" or we adjust paths if context is root
# Let's use context: ./frontend_src in docker-compose for simplicity for frontend
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the frontend code
COPY . .

# Expose the development port
EXPOSE 5173

# Start the app
CMD ["npm", "run", "dev", "--", "--host"]
