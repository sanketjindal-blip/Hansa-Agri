#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  HANSA agriculture machinery customer mobile app. Continuing development:
  this iteration refactored the monolithic 1014-line server.py into modular
  routers (auth, catalog, orders, support, dealers, admin, social, payments)
  under /app/backend/{core,models,routes,services} and added public scraping
  fallbacks for Facebook (og:meta + GoogleBot UA, falls back to static card)
  and Instagram (web_profile_info JSON - returns up to 12 latest posts with
  thumbnails, captions, likes, comments). YouTube already used RSS.

backend:
  - task: "Refactor server.py into modular routers"
    implemented: true
    working: true
    file: "backend/server.py + backend/routes/*.py + backend/core/*.py + backend/services/*.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Split monolith into core/{config,db,security,helpers}, models/schemas, routes/{auth,catalog,orders,support,dealers,admin,social,payments}, services/{seed,warranty,social_scraper}. server.py is now a 60-line entrypoint that wires all routers under /api. Smoke test on all GET routes returned 200. Need full retest of auth-protected POST endpoints (checkout, support tickets, admin promote-dealer, dealer assign-warranty)."
      - working: true
        agent: "testing"
        comment: "Full regression via /app/backend_test.py against the live preview URL: 54/54 assertions passed with zero 5xx. Verified auth (register, duplicate-reject, admin+customer login, invalid-login 401, /auth/me, send-otp sent:true via Twilio, verify-otp with OTP pulled from DB, wrong OTP 400). Catalog public endpoints (products list=19, categories=10, featured=5, by-id, bad-id 404, news, offers, dealers, settings/company). Orders: checkout 401-without-auth, checkout valid, empty-cart 400, unknown-product 404, list, by-id, warranties. Support: create + list tickets; 401 without auth. Admin: stats, 403 for customer, dealers CRUD (create/patch/delete), settings/company patch, promote-dealer, assign-warranty, products CRUD, news, offers, warranty-reminders. Dealer portal: OTP-logged-in dealer (promoted phone) passed /dealer/me (role=dealer, dealer object populated), /dealer/assign-warranty with small base64 bill, /dealer/orders, 401 without auth. Payments /payments/config returns razorpay_enabled:false as expected."

  - task: "Public Instagram & Facebook scraping fallback"
    implemented: true
    working: true
    file: "backend/services/social_scraper.py + backend/routes/social.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added GET /api/social/instagram (returns name, bio, avatar, followers, 12 posts via Instagram web_profile_info JSON), GET /api/social/facebook (og:meta scraping with GoogleBot UA, 6h cache, static fallback when blocked), GET /api/social/feed (combined youtube+ig+fb). Verified IG returned 12 live posts with thumbnails & like counts. FB rate-limits aggressively so we ship a static page card with the verified slug ramkishanagriinnovate."
      - working: true
        agent: "testing"
        comment: "Social endpoints all 200. /social/youtube returned 12 videos (RSS). /social/instagram returned profile object with 12 posts (web_profile_info) and handle field populated. /social/facebook returned static fallback with name='Ram Kishan Agri Innovate Pvt Ltd' and page_url (GoogleBot UA scraping degrades gracefully when FB rate-limits; cache hit on 2nd call). /social/feed combined youtube+instagram+facebook+links into a single object as expected. /social link list also served."

frontend:
  - task: "Social tab redesign with FB/IG/YT segmented tabs"
    implemented: true
    working: "NA"
    file: "frontend/app/social.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Rebuilt with /social/feed call, segmented tabs (YouTube / Instagram / Facebook), profile card with avatar+followers+bio, IG 3-col grid with like/comment overlays, FB static card with Open button. Awaiting user verification on Expo Go."

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 2
  run_ui: false

test_plan:
  current_focus:
    - "Refactor server.py into modular routers"
    - "Public Instagram & Facebook scraping fallback"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Refactored backend to modular structure. All previous routes preserved at
      identical paths. Smoke-tested every GET endpoint -> 200. Please run the
      auth-protected suite: register/login/me, OTP send/verify, products
      featured/categories/listing, orders checkout flow, warranties, support
      tickets create+list, admin stats/promote-dealer/assign-warranty/CRUD on
      dealers+products+news+offers+company, dealer me/assign-warranty, social
      youtube/instagram/facebook/feed, payments config. Test creds in
      /app/memory/test_credentials.md.
  - agent: "testing"
    message: |
      Full backend regression complete — 54/54 test assertions passed with no 5xx.
      Ran /app/backend_test.py against the public preview URL covering:
      auth (register/login/me/send-otp/verify-otp incl. error paths), catalog
      (products+categories+featured+by-id+news+offers+dealers+settings/company),
      orders (checkout valid/empty/bad-product/no-auth, list, by-id, warranties),
      support tickets (create+list+auth), admin (stats, 403 for customer,
      dealers CRUD, settings/company, promote-dealer, assign-warranty, products
      CRUD, news, offers, warranty-reminders), dealer portal (OTP-login via DB-
      sourced code, /dealer/me role=dealer, /dealer/assign-warranty with base64
      bill, /dealer/orders), social (youtube 12 videos, instagram 12 posts from
      web_profile_info, facebook static card, feed combined), payments config
      (razorpay_enabled:false).

      Notes: (a) Twilio is live in this env so send-otp actually returned
      sent:true; the test also pulls the OTP from mongo to complete verify-otp.
      (b) FB scraping is rate-limited but the static fallback object is returned
      as designed with name+page_url populated. (c) No mocks in backend code.
      All auth gates return correct 401/403. No further backend retest required.