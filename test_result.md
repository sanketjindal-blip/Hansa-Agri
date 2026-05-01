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
  version: "1.2"
  test_sequence: 3
  run_ui: false

test_plan:
  current_focus:
    - "In-app notifications API"
    - "Admin Service Request list + assign-to-manager"
    - "Admin manual lead create + assign-to-manager"
    - "Manager assignment-based filtering for leads & service-requests"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      New feature batch ready for backend regression. **Use admin token** for all admin endpoints,
      and **manager phone-OTP login** is unavailable headlessly so manager filtering tests should
      use the admin role (which is treated as a super-manager). Test credentials in /app/memory/test_credentials.md.

      1) Notifications (auth users):
         - GET /api/notifications -> {items:[], unread_count}
         - GET /api/notifications/unread-count
         - POST /api/notifications/mark-read {ids?: [...], all?: true}
         Verify: cross-user isolation (one user cannot see another's), mark-read changes unread_count.

      2) Admin Lead create + assign:
         - POST /api/admin/leads {name, phone, equipment_interest, notes,
           manager_ids: ["mgr-id"], all_managers: false} -> 200 with admin_created:true,
           assigned_manager_ids matches body, source="call", referrer_user_id="" (so no
           500-pt referral payout when later marked purchased — verify this!).
         - POST same with all_managers:true -> all leads-permission managers receive
           in-app notification. Verify notifications collection.
         - POST /api/admin/leads/{id}/assign {manager_ids, all_managers} -> 200
         - Negatives: missing name/phone -> 400; non-admin -> 403.

      3) Admin Service Requests:
         - GET /api/admin/service-requests -> 200 list (admin only)
         - POST /api/admin/service-requests/{sr_id}/assign {manager_ids|all_managers, note}
           -> 200; assigned_manager_ids set; timeline grew with "assigned to N mgr" entry.
         - Verify in-app notifications + SMS attempt logged for each target manager.

      4) Manager assignment filtering:
         - Use admin token (super-manager) -> GET /manager/leads must include unassigned
           and assigned-to-anyone leads (admin sees all).
         - For an actual manager: filter `assigned_manager_ids` should match user.id OR
           empty (visible to everyone).
         - Same for /manager/service-requests.

      5) Manager updates a SR -> customer should now also receive an in-app notification
         (in addition to the existing SMS).

frontend:
  - task: "Dealer Portal product list overlap fix + admin-categories useRouter crash fix"
    implemented: true
    working: "NA"
    file: "frontend/app/dealer-portal.tsx + frontend/app/admin-categories.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: |
          1) dealer-portal.tsx: products list View had maxHeight:280 but no overflow:hidden.
             On iOS RN, Views default to overflow:'visible' so children rendered past the
             container and overlapped Purchase Date / Address / City-State-Pin / Bill / Submit.
             Wrapped the inner list in a nested ScrollView with maxHeight on the inner
             ScrollView (works on iOS) and added overflow:'hidden' to the productList style.
          2) admin-categories.tsx: line 23 referenced useRouter() but the import was removed
             when migrating to safeBack helper. This caused a ReferenceError on render —
             the category screen was crashing for the user. Removed the dangling line.

  - task: "Notifications screen + bell card in profile"
    implemented: true
    working: "NA"
    file: "frontend/app/notifications.tsx + frontend/app/(tabs)/profile.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false

  - task: "Admin Service Requests screen + assign-to-manager"
    implemented: true
    working: "NA"
    file: "frontend/app/admin-service-requests.tsx + frontend/app/(tabs)/profile.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false

  - task: "Admin Leads — Add Lead (call) + Assign-to-manager"
    implemented: true
    working: "NA"
    file: "frontend/app/admin-leads.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false

agent_communication:
  - agent: "main"
    message: |
      Three new features ready for backend regression:
      1) ADMIN_PHONES (+919045666666, +917017509782) seeded as role=admin on
         every startup. Legacy ramesh demo migrated to +919876543210/customer.
         Verify both admin phones appear in /api/admin/users role=admin.
      2) Razorpay TEST keys now live in backend/.env.
         /api/payments/config -> razorpay_enabled:true.
         /api/payments/razorpay/create-order should return order_id & key_id.
      3) Loyalty/Leads end-to-end:
         - Customer POST /api/leads {name, phone} mandatory -> status='new'.
         - GET /api/leads/mine returns the lead.
         - GET /api/me/points -> {balance, transactions, point_value_inr:1}.
         - Admin PATCH /api/admin/leads/{id} {status:'purchased'} ->
           lead.points_awarded=500, referrer balance +=500.
         - Re-PATCH same lead with 'purchased' MUST NOT double-award.
         - POST /api/admin/points/adjust {user_id, delta:-100, reason} ->
           writes a points_transaction.
         - POST /api/orders/checkout with redeem_points=300 reduces total by 300
           and decrements user's balance by 300. Out-of-range redeem must cap.
      Test creds in /app/memory/test_credentials.md.

backend:
  - task: "Manager role + Service Request system"
    implemented: true
    working: true
    file: "backend/routes/manager.py + backend/routes/service.py + backend/routes/admin.py + backend/core/security.py + backend/models/schemas.py + frontend/app/manager.tsx + frontend/app/admin-managers.tsx + frontend/app/service-request.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: |
          Full regression for Manager + Service Request features via /app/backend_test.py against the public preview URL — 26/26 assertions passed, zero 5xx.
          A) Admin managers: POST /api/admin/managers {phone:"9991110099", perms_leads:true, perms_service:true} -> 200 role=manager, manager_perms={leads:true,service:true}. GET /api/admin/managers lists it. PATCH {perms_leads:true, perms_service:false} -> 200 perms updated. PATCH with both false -> 400 "At least one permission must be enabled". POST phone="123" -> 400 "Invalid phone". POST with both perms false -> 400. DELETE -> 200 {demoted:true}; subsequent GET no longer contains them.
          B) Service requests (multipart) as customer ramesh@farm.com: POST /api/service-requests with title/description and a real JPG as `photo` -> 200 with id, status="open", photo.url starting with /api/uploads/, timeline length 1. GET /api/service-requests/mine returns the new SR. GET /api/service-requests/{id} as owner -> 200. POST without title -> 422 (FastAPI Form validation). POST empty description -> 400. POST with fake .gif -> 400 "Photo type .gif not allowed". GET /api/uploads/{filename} -> 200 serves bytes. GET /api/uploads/..%2Fetc%2Fpasswd -> 404 (path-traversal blocked).
          C) Manager flow with admin token: GET /api/manager/me -> 200 perms={leads:true,service:true}. GET /api/manager/service-requests contains the SR. PATCH to status=in_progress with note -> 200, status updated, timeline length grew to 2. PATCH to status=resolved with resolution -> 200, resolution stored. PATCH status=foobar -> 400. PATCH non-existent id -> 404. GET /api/manager/leads (admin) -> 200 list.
          D) Permission gating as customer (ramesh): GET /api/manager/service-requests -> 403, GET /api/manager/leads -> 403, POST /api/admin/managers -> 403.
          No backend errors. Feature cleared.
      - working: "NA"
        agent: "main"
        comment: |
          New ROLE 'manager' with per-user `manager_perms: {leads, service}`.
          Endpoints:
            ADMIN
              GET    /api/admin/managers
              POST   /api/admin/managers {phone, name?, perms_leads, perms_service}  (auto-creates user, sends welcome SMS)
              PATCH  /api/admin/managers/{id} {perms_leads, perms_service}  (must keep at least one true)
              DELETE /api/admin/managers/{id}  (demote -> customer)
            MANAGER (admin also passes)
              GET    /api/manager/me
              GET    /api/manager/leads?status=  +  PATCH /api/manager/leads/{id}
              GET    /api/manager/service-requests?status=  +  PATCH /api/manager/service-requests/{id} {status, note?, resolution?}
            CUSTOMER
              POST   /api/service-requests   (multipart: title, description, product_id?, order_id?, photo?, video?)
              GET    /api/service-requests/mine
              GET    /api/service-requests/{id}
              GET    /api/uploads/{filename}  (static, defensive path-traversal check)
          Storage: photos (\u22645 MB) and videos (\u226430 MB) saved under /app/backend/uploads/.
          Service request status flow: open -> in_progress -> resolved -> closed | cancelled.
          Smoke-tested: promote/list/patch/demote managers; create SR with photo + serve via /api/uploads; admin update SR with note. SMS notification sent to customer on status change. Validations covered (both-perms-off -> 400, invalid status -> 400, oversized files -> 413, wrong file types -> 400).

  - task: "Categories drag-to-reorder + product picker uses category list + multi-product warranty"
    implemented: true
    working: true
    file: "backend/routes/admin.py + backend/services/warranty.py + backend/models/schemas.py + backend/routes/dealers.py + frontend/app/admin-categories.tsx + frontend/app/admin-products.tsx + frontend/app/dealer-portal.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: |
          Targeted regression — 27/27 assertions passed via /app/backend_test_review.py against the public preview URL. Zero 5xx.
          Reorder: GET /api/admin/categories returned 10 items with full {id,key,label,icon,sort_order,active} shape.
          POST /api/admin/categories/reorder with reversed ids returned 200, response sorted by sort_order ascending matched the reversed input, and every sort_order = (index+1)*10. Public GET /api/categories reflected the new ordering (active subset). Negatives covered: empty ids list → 400 ("ids is required"); empty body → 422 (FastAPI validation); no auth → 401; customer token → 403. Order was restored to original after testing.
          Multi-warranty (admin): POST /api/admin/assign-warranty with items=[{p1,qty=2},{p2,qty=1}] → 200, items.length==2, status="delivered", subtotal & total == sum(price*qty)=169500. Legacy single body {phone,product_id,quantity:1} → 200 with items.length==1 (backwards compat preserved). Negative: body without items[] and without product_id → 400 "At least one product is required". Negative: items containing invalid product_id → 404 "Product non-existent-id-xyz not found".
          Verified at DB level (motor) that the auto-created customer +919871234500 has BOTH orders: one with 2 items (total 169500) and one with 1 item (total 48500), both status=delivered. /api/orders endpoint requires the user's own JWT and SMS-OTP login, which we cannot perform headlessly, so verification was done via admin/users + direct DB read instead.
          Dealer endpoint /api/dealer/assign-warranty shares the same warranty service; not directly invoked because OTP login as a dealer requires reading SMS, but the underlying assign_warranty service is fully exercised through the admin path (same code path, only role_label differs).
      - working: "NA"
        agent: "main"
        comment: |
          THREE upgrades:
          1) `POST /api/admin/categories/reorder {ids:[...]}` persists order; FE
             uses react-native-draggable-flatlist for long-press drag in
             /admin-categories. Ids passed in display order; backend writes
             sort_order=(index+1)*10.
          2) Admin Products form: dropdown chips now read from
             /api/admin/categories (instead of hardcoded list) and show the
             configured icons.
          3) Warranty assignment now accepts `items: [{product_id, quantity}]`
             via new MultiAssignWarrantyIn schema. Both /api/admin/assign-warranty
             and /api/dealer/assign-warranty support it. Legacy single
             product_id+quantity payload still works (backwards compat).
             services/warranty.py creates ONE order document per call with all
             selected products and one shared bill_image. SMS now lists every
             activated product in a single message.
             Frontend dealer-portal.tsx replaced single chip selector with a
             searchable multi-select list (checkbox + per-item +/- qty controls)
             plus running total. Admin role can also use this flow.
          Smoke-tested all three flows; 200 OK on every call.

  - task: "Configurable categories with admin CRUD + icons"
    implemented: true
    working: true
    file: "backend/routes/catalog.py + backend/routes/admin.py + backend/services/seed.py + frontend/app/admin-categories.tsx + frontend/app/(tabs)/catalog.tsx + frontend/app/(tabs)/index.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: |
          Full regression passed — 21/21 assertions via /app/backend_test_categories.py.
          Verified: (1) GET /api/categories public returns 10 default categories {Tiller, Harrow, Plough, Cultivator, Subsoiler, Leveller, Weeder, Bund Maker, Ridger, Trench Maker} sorted ascending by sort_order with correct shape {id, key, label, icon, sort_order, active} and active-only filter. (2) GET /api/admin/categories returns full list (admin), 401 without auth. (3) POST valid category 200 with id; duplicate key → 400; customer token → 403. (4) PATCH icon/label/active=false 200 and public list correctly excludes inactive; re-PATCH with key NewKey 200 and response reflects rename. (5) DELETE returns {deleted:true}; re-DELETE → 404. (6) Negative: empty key → 400 "key is required"; PATCH non-existent id → 404; DELETE non-existent id → 404. No 5xx observed. Backend logs clean.
      - working: "NA"
        agent: "main"
        comment: |
          New `categories` collection {id, key, label, icon, sort_order, active}.
          Endpoints:
            GET  /api/categories  — public, returns active categories sorted by sort_order
            GET  /api/admin/categories  — admin, includes inactive
            POST /api/admin/categories  {key, label, icon, sort_order, active}
            PATCH /api/admin/categories/{id}  — also renames matching products' category if key changed
            DELETE /api/admin/categories/{id}
          Seed sets the original 10 (Tiller/Harrow/Plough/Cultivator/Subsoiler/Leveller/Weeder/Bund Maker/Ridger/Trench Maker) with default Ionicons. Auto-picks up any product category not yet configured.
          Frontend:
            - Catalog & Home now read from /categories with icon chips (Ionicons name from DB).
            - New /admin-categories screen has add/edit/delete + icon picker (~46 Ionicons options) + active toggle + sort_order.
          Smoke-tested CRUD: create/update (rename + hide)/delete; public correctly omits inactive.

  - task: "Mobile-OTP-only Admin login (seed admin phones)"
    implemented: true
    working: true
    file: "backend/services/seed.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: false
        agent: "testing"
        comment: "Initial seed had +919045666666 missing because migrate_demo_customer_phone ran AFTER seed_admin_phones and downgraded that record."
      - working: true
        agent: "main"
        comment: "Fixed: seed_admin_phones now matches by phone OR synthetic email and falls back to update on DuplicateKeyError. Verified post-restart: GET /api/admin/users contains both +919045666666 and +917017509782 with role=admin."

  - task: "Razorpay TEST keys live"
    implemented: true
    working: "NA"
    file: "backend/.env + backend/routes/payments.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true

  - task: "Lead referral & loyalty points system"
    implemented: true
    working: "NA"
    file: "backend/services/loyalty.py + backend/routes/loyalty.py + backend/routes/admin.py + backend/routes/orders.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true

frontend:
  - task: "Login screen - mobile OTP only (remove email/admin login UI)"
    implemented: true
    working: "NA"
    file: "frontend/app/(auth)/login.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false

  - task: "Refer & Earn screen + Profile points card"
    implemented: true
    working: "NA"
    file: "frontend/app/refer.tsx + frontend/app/(tabs)/profile.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false

  - task: "Admin Leads & Points management screen"
    implemented: true
    working: "NA"
    file: "frontend/app/admin-leads.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false

  - task: "Checkout - Redeem points UI"
    implemented: true
    working: "NA"
    file: "frontend/app/checkout.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
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
  - agent: "testing"
    message: |
      Manage Categories regression (new feature) — 21/21 assertions passed, zero 5xx.
      Ran /app/backend_test_categories.py against the public preview URL. Covered:
      GET /api/categories public (shape {id, key, label, icon, sort_order, active},
      sorted ascending by sort_order, contains all 10 defaults, active-only),
      GET /api/admin/categories (admin 200 / anon 401), POST /api/admin/categories
      (valid 200 with id, duplicate key → 400, customer token → 403), PATCH
      (icon+label+active=false 200 and public list correctly excludes inactive,
      re-PATCH key rename → 200), DELETE (200 {deleted:true}, re-DELETE → 404),
      negatives (empty key → 400 "key is required", PATCH/DELETE unknown id → 404).
      No backend errors. Feature cleared.
  - agent: "testing"
    message: |
      Targeted regression for "Categories drag-to-reorder" + "Multi-product warranty"
      via /app/backend_test_review.py — 27/27 assertions passed, zero 5xx, zero failures.

      1) POST /api/admin/categories/reorder
         - GET /api/admin/categories baseline returned 10 cats with required shape.
         - Reversed-id POST → 200, response sorted asc by sort_order matched the reversed
           ids exactly, sort_order = (idx+1)*10 verified for all 10.
         - Public GET /api/categories reflected the new ordering.
         - Negatives: empty ids → 400 ("ids is required"), missing body → 422,
           no auth → 401, customer token → 403. Order restored at the end.

      2) Multi-product warranty (admin path):
         - items=[{p1,qty=2},{p2,qty=1}] → 200, items.length==2, status="delivered",
           subtotal & total = 169500 (sum price*qty).
         - Legacy single-product body (product_id+quantity) → 200 with items.length==1
           (backwards compat preserved).
         - No items[] and no product_id → 400 "At least one product is required".
         - Invalid product_id in items → 404 "Product non-existent-id-xyz not found".
         - DB-level verification confirmed the auto-created customer +919871234500
           has BOTH orders (2 items / 169500 and 1 item / 48500), both delivered.

      Notes / scope:
      - Direct GET /api/orders for the auto-created phone customer requires SMS-OTP
        login (no SMS readback in this env) so verification was via admin/users +
        direct DB read instead.
      - /api/dealer/assign-warranty was not invoked directly (dealer OTP login not
        feasible headlessly), but it shares the exact same warranty service code as
        admin path (only role_label differs), which is fully exercised here.

      No further backend retest required for these two features.
  - agent: "testing"
    message: |
      New-feature regression (Notifications + Admin Leads + Admin Service Requests +
      Manager filtering) via /app/backend_test_session.py against the public preview URL.
      RESULT: 59 PASS / 1 FAIL, zero 5xx.

      A) Notifications (PASS): GET /notifications without auth -> 401; with auth ->
         200 with {items:[], unread_count}; GET /unread-count -> 200; mark-read by ids
         and all=true both work; unread_count drops to 0 after all=true; cross-user
         isolation verified — mgr1 sees lead-assigned notification, mgr2 does not.
      B) Manager promotion (PASS): created mgr1 (+919999988887, leads+service) and
         mgr2 (+919999988888, service only); demoted both at end.
      C) Admin Leads create + assign (mostly PASS, 1 FAIL):
         - POST /admin/leads with manager_ids=[mgr1] -> 200; admin_created=True,
           source="call", referrer_user_id="", assigned_manager_ids=[mgr1]. mgr1 got
           in-app notif type=lead_assigned; mgr2 did NOT (cross-user isolation).
         - POST /admin/leads with all_managers=true -> assigned_manager_ids contains
           mgr1 only (mgr2 lacks leads perm). mgr1 notified, mgr2 not.
         - POST /admin/leads/{id}/assign -> 200, assigned_manager_ids updated.
         - Negatives: empty name -> 400; invalid phone -> 400; non-admin -> 403. All PASS.
         - **CRITICAL FAIL**: PATCH /admin/leads/{admin_created_lead_id} {status:"purchased"}
           returns **400 "User not found"**. Root cause: services/loyalty.py:111
           checks `if new_status=="purchased" and not lead.get("points_awarded")`
           but does NOT check that `referrer_user_id` is non-empty. For admin-created
           leads referrer_user_id="" so adjust_points("") raises ValueError("User not
           found") → route returns 400. The lead status never updates to purchased,
           breaking the documented "admin-created leads can be marked purchased
           without payout" behavior. FIX: add `and lead.get("referrer_user_id")` to the
           guard at services/loyalty.py:111.
      D) Admin Service Requests (PASS): customer ramesh created SR with photo;
         admin GET /admin/service-requests contains it; status=open filter works;
         POST /admin/service-requests/{id}/assign with manager_ids=[mgr2] sets
         assigned_manager_ids=[mgr2] and adds timeline entry "assigned to 1 mgr"
         with note. mgr2 got notif type=service_assigned ref_id=sr_id. Re-assign
         all_managers=True now includes BOTH mgr1 and mgr2 (both have service perm).
      E) Manager filtering (PASS): admin (super-manager) GET /manager/leads sees
         admin-created lead; GET /manager/service-requests sees the SR. Customer
         hitting /manager/leads and /manager/service-requests -> 403. PATCH
         /manager/service-requests/{id} {status:"in_progress", note} -> 200; customer
         (ramesh) immediately sees a NEW notification type=service_status
         ref_id=sr_id in their /notifications inbox.
      F) Cleanup (PASS): DELETE /admin/managers/{mgr1_id} and {mgr2_id} both 200.

      ACTION FOR MAIN AGENT: Fix loyalty.update_lead_status guard to skip the
      referral payout when referrer_user_id is empty. After fix, the PATCH should
      return 200 with status=purchased and points_awarded=0/absent.

  - agent: "testing"
    message: |
      Manager + Service Request regression via /app/backend_test.py — 26/26 passed, zero 5xx.
      A) Admin managers: create (9991110099, perms_leads+service=true) -> 200 role=manager; list contains new mgr;
         PATCH perms_leads:true/perms_service:false -> 200; PATCH both false -> 400 "At least one permission must be enabled";
         POST phone="123" -> 400 "Invalid phone"; POST both perms false at create -> 400;
         DELETE -> 200 {demoted:true} and subsequent GET no longer lists them.
      B) Service requests (customer ramesh@farm.com): POST /api/service-requests (multipart w/ real JPG) -> 200, status=open,
         photo.url starts with /api/uploads/, timeline length 1; GET /service-requests/mine contains it; GET by id as owner -> 200;
         POST no title -> 422 (FastAPI Form validation); POST empty description -> 400; POST with fake .gif -> 400;
         GET /api/uploads/{filename} serves bytes; GET /api/uploads/..%2Fetc%2Fpasswd -> 404 (traversal blocked).
      C) Manager flow with admin token: GET /manager/me -> 200 perms.leads&service=true; GET /manager/service-requests
         contains SR; PATCH -> in_progress with note grows timeline to 2; PATCH -> resolved with resolution stored;
         PATCH invalid status -> 400; PATCH non-existent id -> 404; GET /manager/leads -> 200 list.
      D) Gating: customer hitting /manager/service-requests, /manager/leads, /admin/managers all return 403.
      No backend errors in logs. Feature cleared; no further backend retest required.
