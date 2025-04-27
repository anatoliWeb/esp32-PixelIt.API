# PixelIt.API — Локальний запуск із Docker та MySQL

## Кроки для запуску проєкту

---

### 1. Підготовка

1. Встанови **Docker Desktop** для Windows / Linux / Mac:
   - https://www.docker.com/products/docker-desktop/

2. Переконайся, що Docker працює:
   ```bash
   docker --version
   docker-compose --version
   ```

---

### 2. Розпакування файлів

1. Розпакуй цей архів у папку твого проєкту.

Ти маєш бачити файли:

- `docker-compose.yml`
- `.env`
- `README_RUN.txt` (цей файл)

---

### 3. Запуск проєкту

У терміналі в папці з файлами запусти:

```bash
docker-compose up -d
```

- Це створить два сервіси:
  - `pixelit_api` — сервер PixelIt API (порт 8080)
  - `mysql_db` — база даних MySQL (порт 3306)

- Сервер буде доступний за адресою:
  - http://localhost:8080

---

### 4. Налаштування доступу до бази даних

Параметри бази даних за замовченням:

| Параметр    | Значення          |
|:------------|:-------------------|
| Host        | mysql_db            |
| Port        | 3306                |
| Database    | pixelit             |
| User        | root                |
| Password    | your_password       |

Якщо хочеш підключитись до бази напряму через DBeaver / HeidiSQL, використовуй IP або `localhost` + порт `3306`.

---

### 5. Зупинка сервісів

Щоб зупинити сервіси:

```bash
docker-compose down
```

Щоб перезапустити сервіси після змін:

```bash
docker-compose restart
```

---

### 6. Змінні середовища

Можеш змінити параметри в `.env` файлі, наприклад:

- Порт сервера (`PORT=8081`)
- Налаштування бази даних (`MYSQL_HOST`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`)
- Ключі для SEQ та GitHub

Після зміни `.env` не забудь перезапустити сервіси (`docker-compose down` + `docker-compose up -d`).

---

## Готово! 🎉
Тепер твій локальний сервер PixelIt.API готовий для роботи.

http://localhost:8081/api/Statistics
-------------------------------
docker-compose down
docker-compose up -d --build

