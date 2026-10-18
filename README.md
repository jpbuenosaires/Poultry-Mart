# Poultry Mart

Web-based online poultry ordering and delivery system. Customers browse and order poultry products, while admin, fulfillment staff, and delivery riders each use their own portal to manage the order from stock to doorstep.

Developed by a team of 4 as an academic project at Bicol University (BS Information Technology). Lead developer: Jayson Buenosaires.

## Features

- **Customer portal** (`index.php`): product browsing by category, cart, checkout, delivery address and time slot, order tracking, reviews, promo codes, and wholesale pricing tiers.
- **Admin portal** (`admin.php`): users and roles, products, categories, inventory batches, delivery zones, operational hours, reports, and audit logs.
- **Fulfillment portal** (`fulfillment.php`): order preparation and stock handling.
- **Rider portal** (`rider.php`): assigned deliveries, delivery status updates, and cash remittance.
- Notifications, dispute handling, and cancellation logs.

## Tech stack

PHP, MySQL/MariaDB, JavaScript, HTML, CSS. Separate API endpoint per role in `api/`, with business logic in `api/services/`.

## Project structure

```
api/          REST-style endpoints per role (admin, customer, fulfillment, rider), db.php, services/, helpers/
css/ js/      Front-end styles and controllers for each portal
components/   Shared UI components and product image assets
database/     schema.sql - 25-table MySQL schema (structure only, no data)
uploads/      Runtime uploads (not tracked)
```

## Setup

1. Install XAMPP (or any Apache + PHP + MySQL/MariaDB stack) and copy this folder into `htdocs`.
2. Create a database named `poultry_mart_git` and import `database/schema.sql`.
3. Copy `api/config.example.php` to `api/config.php` and set your database credentials.
4. Open `http://localhost/<folder-name>/index.php`. The other portals are `admin.php`, `fulfillment.php`, and `rider.php`.

The schema has no data, so create your first admin user directly in the `users` table.
