FROM node:21

# Створюємо робочу директорію
WORKDIR /app


# Копіюємо package.json і package-lock.json
COPY package.json ./


# Встановлюємо залежності
RUN npm install

# Копіюємо весь проект (але буде перекрито локальним volume)
COPY . .

# Відкриваємо порт
EXPOSE 8081

# Команда за замовчуванням
CMD ["npm", "run", "dev"]
# CMD [ "node", "main.js" ]