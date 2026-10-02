# Beauty AI Frontend

Frontend application for **Beauty AI** — a beauty services booking platform with personalized recommendations, salon discovery, booking workflows, role-based dashboards, and AI-assisted search.

## Overview

Beauty AI is a team project focused on simplifying the process of finding, booking, and managing beauty services.

The frontend includes interfaces for:

- customers;
- beauty masters;
- administrators.

The platform combines service discovery, booking functionality, personalized recommendations, role-based dashboards, and platform integration in one web application.

## Preview

### Home Page

<img src="docs/home.jpg" width="100%" alt="Beauty AI Home Page">

### Personalized Recommendations

<img src="docs/home-recommendations.jpg" width="100%" alt="Beauty AI Personalized Recommendations">

### Discovery Sections

<img src="docs/discovery-masters.jpg" width="100%" alt="Beauty AI Masters and Top Rated">

<img src="docs/discovery-offers.jpg" width="100%" alt="Beauty AI Partner Offers and Recommendations">

### Booking Flow

<img src="docs/booking.jpg" width="100%" alt="Beauty AI Booking Flow">

### User Dashboard

<img src="docs/user-dashboard.jpg" width="100%" alt="Beauty AI User Dashboard">

### Master Dashboard

<img src="docs/master-dashboard.jpg" width="100%" alt="Beauty AI Master Dashboard">

### Admin Dashboard

<img src="docs/admin-dashboard.jpg" width="100%" alt="Beauty AI Admin Dashboard">

## My Contribution

As part of the project, I worked on frontend implementation, interface development, dashboards, booking flows, AI-related interface elements, and platform integration.

My contribution includes:

- implementing and updating the main frontend interface;
- building reusable React components;
- developing search and category filtering;
- integrating the salon map;
- implementing personalized recommendation sections;
- developing the booking flow;
- developing role-based dashboards for customers, masters, and administrators;
- working with platform data and REST API integration;
- implementing JWT-based authentication flows;
- adapting the UI to product and UX requirements;
- organizing and maintaining the frontend project structure.

## Tech Stack

- **React**
- **TypeScript**
- **Vite**
- **CSS**
- **REST API**
- **JWT Authentication**
- **OpenStreetMap**

## Main Features

### AI-Assisted Search

Users can describe the beauty service they are looking for and interact with the platform through the Beauty AI search interface.

### Search & Navigation

Users can search for beauty services and salons and navigate through the main sections of the platform.

### Category Filters

The interface includes category-based filtering to help users quickly find relevant beauty services.

### Personalized Recommendations

The platform includes recommendation sections for salons, masters, partner offers, and other relevant beauty services.

### Salon Map

The frontend includes an interactive map for discovering beauty locations.

### Booking Flow

Users can select a service, available date and time, enter contact information, and confirm an appointment.

### User Dashboard

Customers can view and manage appointments, favourites, reviews, and loyalty information.

### Master Dashboard

Masters can manage appointments, availability, schedules, client activity, reviews, services, and profile information.

### Admin Dashboard

Administrators have access to platform-level information including bookings, clients, masters, salons, services, payments, reviews, and system settings.

Detailed analytics are implemented in the separate **Beauty AI Admin Panel** project.

### Authentication & Roles

The frontend uses JWT-based authentication and supports role-based access for:

- customer;
- master;
- admin.

## Project Structure

```text
beauty-ai-frontend/
├── public/
├── docs/
├── src/
│   ├── assets/
│   ├── api/
│   ├── dashboard/
│   ├── App.tsx
│   ├── App.css
│   ├── BeautyAssistant.tsx
│   ├── CategoryFilters.tsx
│   ├── FilterBar.tsx
│   ├── MapSection.tsx
│   ├── index.css
│   └── main.tsx
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
