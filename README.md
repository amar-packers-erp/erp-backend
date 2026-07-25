# ERP Backend

## Enterprise Resource Planning (ERP) Backend

A scalable and modular backend powering a production-oriented ERP system for managing business operations in the packaging manufacturing industry. The backend exposes RESTful APIs that support authentication, order management, inventory tracking, customer management, production workflow, and dispatch operations.

---

## Project Overview

This project serves as the backend of a full-stack ERP system developed using **Node.js**, **Express.js**, and **MongoDB**. It provides secure APIs, role-based authentication, and a structured architecture designed for maintainability and future scalability.

The backend is responsible for handling business logic, database operations, authentication, and communication with the frontend application.

---

## Core Features

### Authentication

* Secure user authentication
* Session-based authentication
* Role-based authorization
* Protected API endpoints
* Secure HTTP-only session cookies

---

### Order Management

* Create orders
* Update orders
* Track production status
* Dispatch management
* Order lifecycle management

---

### Inventory Management

* Inventory CRUD operations
* Material categorization
* Stock tracking
* Product management
* Inventory reporting

---

### Customer Management

* Customer information management
* Order association
* Customer records

---

### Dashboard APIs

* Business statistics
* Inventory summary
* Order analytics
* Operational overview

---

### Business Workflow

* Manufacturing workflow
* Job work management
* Dispatch processing
* Production tracking

---

## Technology Stack

### Backend

* Node.js
* Express.js
* TypeScript

### Database

* MongoDB
* Mongoose

### Validation

* Zod

### Security

* HTTP-only Cookies
* Session Authentication
* Role-Based Access Control (RBAC)

---

## Architecture

```text
React Frontend
        │
        ▼
REST API
        │
        ▼
Express.js Server
        │
        ▼
Business Logic
        │
        ▼
MongoDB Database
```
---

## API Design

The backend follows RESTful API principles with modular routing and separated business logic.

Example modules include:

* Authentication
* Orders
* Inventory
* Dashboard
* Customers
* Dispatch
* Job Work

---

## Authentication Flow

* User submits credentials
* Backend validates authorized user
* Session token is generated
* Secure HTTP-only cookie is issued
* Protected routes verify session before granting access

---

## Security Features

* Role-based authorization
* Protected middleware
* Secure session handling
* Input validation
* Environment-based configuration
* Centralized authentication

---

## Highlights

* Modular backend architecture
* Production-ready REST APIs
* Type-safe development with TypeScript
* Clean project organization
* Efficient MongoDB integration
* Maintainable codebase
* Scalable API structure

---

## Deployment

The backend is designed for deployment on modern cloud platforms and can be hosted on services such as Render while connecting to a managed MongoDB database.

---

## Repository Notice

This repository contains the backend implementation of a private business ERP system.

To protect proprietary business logic and sensitive operational workflows:

* Deployment credentials and configuration files are intentionally excluded.
* Environment variables and secrets are not included.
* The repository is intended for portfolio and project showcase purposes only.
* Commercial reuse or redistribution is not permitted without authorization.

---

## Author

**Adarsh Kumar** | 
**Harshit Pal** |
**Vishal Bhadauria**

Designed and developed using **Node.js**, **Express.js**, **TypeScript**, and **MongoDB** to power a real-world ERP system for business process management.
