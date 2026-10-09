# DEFINE 4.0

The official project submission repository for **DEFINE 4.0 — The World's Realest Hackathon**.

---

# OpenAttic

<!-- Add your project cover image below -->

![Project Cover](./assets/cover.png)

## Team Information

- **Team Name**:Coffee.java
- **Track**:Design

## Team Members

| Name | Role | GitHub | LinkedIn |
|------|------|--------|----------|
| Abhedh Krishnan JR | Leader | [@username](https://github.com/krizxjr) | [Profile](https://linkedin.com/in/abhedh-krishnan-j-r-b64a81381) |
| Arathy Krishna AM | Member | [@username](https://github.com/arathy-2007) | [Profile](https://linkedin.com/in/arathykrishnaam) |
| Eshan MS | Member | [@username](https://github.com/eshanms) | [Profile](https://linkedin.com/in/eshan-ms-462802390) |
| Gokul Viswa P | Member | [@username](https://github.com/xbox-one-x-guy) | [Profile](https://linkedin.com/in/gokul-viswa-p-863a58381) |
| S Aswini Devi | Member | [@username](https://github.com/aswiniidevi) | [Profile](https://linkedin.com/in/aswini-devi-3b66b23ab) |

---

# Project Details

## Overview

Students frequently waste valuable time hunting for study materials scattered across random platforms, folders, and browser tabs. OpenAttic solves this by providing a centralised dashboard that brings notes, textbooks, videos, and code repositories together in one unified place. This allows students to effortlessly organise their resources by subject and instantly discover everything they need for their studies.

## Problem Statement

Notes, PDFs, YouTube videos, GitHub repositories, previous-year questions, and textbooks are often scattered across different platforms, making it difficult for students to find, organise, and use the right study resources.

### What is the problem?

Study resources (lecture notes, PDFs, YouTube tutorials, GitHub repos, PYQs, textbooks) are fragmented across random platforms, cloud folders, and chats, making them a nightmare to track down.

### Who is affected by it?

Students and peer study groups within our institution who need a reliable, shared repository of materials tailored to our curriculum.

### Why is solving it important?

It eliminates administrative friction, keeps every classmate on the same page, and ensures that institutional knowledge (like previous-year questions and notes) isn't lost in chat histories.

### Limitations of existing solutions:

Generic cloud folders or personal bookmarks don't scale across a college batch, lack structured topic tagging, and fail to handle multi-format media like embedded GitHub repos or YouTube timestamps in a single academic workspace.

## Solution

To fix the midnight panic of hunting through random WhatsApp groups and scattered Drive links, we built StudyHub. It acts as a single campus dashboard that consolidates PDFs, YouTube videos, GitHub repos, and notes into one searchable, subject-organized workspace so students can stop searching and start studying.

## How it works

1. **Add a resource.** Save a useful link or upload a supported file to the library.
2. **Organise it.** Associate resources with subjects and topics so they are easier to revisit.
3. **Find it later.** Search the library and narrow results with filters and sorting.
4. **Open the material.** Follow a resource link or access an uploaded file through the application.
5. **Review the collection.** Use the dashboard to get an overview of the resource library.

---

# Demo

### Demo Video

[Watch Project Demo](https://www.youtube.com/watch?v=VIDEO_ID)

> Replace `VIDEO_ID` with your YouTube video ID.

### Screenshots

<!-- Add screenshots of your project here -->

![Screenshot 1](./assets/screenshot-1.png)

![Screenshot 2](./assets/screenshot-2.png)

![Screenshot 3](./assets/screenshot-3.png)

---

# Live Project

[Visit Live Project](https://your-project-url.com/)

---

# Technical Implementation

## Technologies Used

| Category | Technologies |
|----------|--------------|
| **Frontend** | React + Vite |
| **Backend** | Python Flask |
| **Database** | PostGresSQL (hosted at SupaBase for Demo) |
| **APIs / Services** | PostgreSQL Flask Driver (psycopg3) |
| **AI / ML** | - |
| **DevOps / Deployment** | git / GitHub |
| **Other Tools** | Zed, VS Code, NP++ |

## System Architecture

<!-- Add your architecture diagram here -->

![System Architecture](./assets/architecture.png)

## Key features

- **Centralised resource library** for study materials and useful external links.
- **Subject and topic organisation** to keep resources grouped by course content.
- **Search, filtering, sorting, and pagination** to help users find relevant material in a growing library.
- **File uploads** for supported study documents and images.
- **Private file storage access** using time-limited signed URLs for uploaded files.
- **Dashboard overview** of the resource collection.
- **REST API backend** connecting the frontend to resource, subject, topic, and dashboard data.

---

# Setup Instructions

## Prerequisites

Make sure the following are installed before running the project:

- Requirement 1
- Requirement 2
- Requirement 3

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
