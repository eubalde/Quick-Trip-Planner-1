Voyager

An AI-powered travel itinerary planner designed for fast, structured city trips with minimal user effort.

Overview

Voyager is a modern travel planning application focused on simplifying short city trips (1–7 days). Instead of overwhelming users with endless options, Voyager generates a clean, structured itinerary in seconds based on user preferences and travel pace.

The application combines AI-generated recommendations with rules-based logic to validate, rank, and organize activities into a practical and efficient plan. The goal is not perfect customization, but a reliable “good enough” itinerary that saves time and reduces decision fatigue.

Voyager was built to address the frustration of manual trip planning, where users often rely on scattered tools like maps, blogs, and notes apps. It is designed specifically for young adults who want a quick, low-effort, and adventure-focused travel experience.

Features
AI-powered itinerary generation for 1–7 day city trips
Interest-based personalization (e.g., food, history, nature)
Adjustable travel pace (relaxed, standard, packed)
Rules-based validation to improve itinerary quality and relevance
Step-by-step guided user flow
Clean, intuitive navigation system
Fast itinerary generation with minimal input
Current MVP Scope
Destination-based itinerary generation
Date selection with 7-day trip cap
Interest selection (up to 3 preferences)
Travel pace customization
Structured daily itinerary output
Basic navigation (plans, itineraries, saved items, profile)

The application currently focuses on core planning functionality and does not include advanced collaboration, real-time updates, or full external integrations.

How It Works
The user enters a destination city.
Travel dates are selected using an interactive calendar (maximum 7 days).
The user selects up to three interests.
The user chooses a preferred travel pace.
Voyager generates activity suggestions using AI.
A rules-based system validates, filters, and organizes results.
A structured, day-by-day itinerary is displayed instantly.
Tech Stack

Frontend: React, Vite
AI Integration: Replit AI, ChatGPT (prompt optimization)
Styling: CSS / Tailwind (if applicable)
State Management: React Hooks
Build Tool: Vite

Project Structure
/src/
  components/
  pages/
  assets/
  App.jsx
  main.jsx

/public/
  index.html

package.json
vite.config.js
Setup Instructions

Prerequisites:

Node.js 18+
npm

Installation:

git clone https://github.com/your-username/voyager.git
cd voyager
npm install

Run Development Server:

npm run dev

App runs at: http://localhost:5173

Build for Production:

npm run build

Output is generated in: dist/

Preview Production Build:

npm run preview
Deployment

This project is designed for static deployment.

Build command: npm run build
Output directory: dist/
Design Decisions

Voyager was designed to prioritize speed, simplicity, and usability for short trips.

Focus on 1–7 day city itineraries only
“Good enough” planning instead of over-customization
AI + rules-based hybrid system for better reliability
Guided flow to reduce user friction
Lightweight architecture for fast performance
Development Process & Challenges

Voyager was initially defined using a product requirements document generated with ChatGPT, which helped shape the app concept and feature set.

The core application was built using Replit AI, which generated the initial structure. Development involved multiple iterations of testing, debugging, and refinement, supported by prompt optimization techniques.

Key challenges included:

AI hallucinations (invalid locations, closed venues, incorrect cities)
Lack of itinerary diversity (repeated locations and restaurants)
Mismatched recommendations outside selected user interests

Solutions:

Iterative debugging with structured prompts
Prompt optimization simulating expert developer roles
Improved filtering and validation logic
Future Improvements
Persistent itineraries (localStorage or backend)
Collaborative trip planning (invite friends, co-edit itineraries)
Travel achievement system (stamps, progress tracking)
“Surprise Me” mode for random destinations and themes
Google Calendar integration
Notifications and trip reminders
Improved UI/UX and engagement features
License

This project is licensed under the MIT License.

Author

Earl Ubalde, Ester Tane, Marium Sheikh, Neharika Kalyan, Yu-Hsi Chang

Open Source

This repository is released under the MIT License.
