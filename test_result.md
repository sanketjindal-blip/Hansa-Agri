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
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "testing"
    message: |
      Inventory retest after schema fix — **15/15 PASS, zero 5xx**.
      GET /api/admin/inventory/summary (admin) → 200 with correct shape:
      totals.products matches DB count, by_category has 10 rows with
      {id,name,key,icon,products_count,in_stock_count,out_of_stock_count,
      avg_price,total_value,active}, name drawn from category.label, totals
      arithmetic verified vs DB, _uncategorised correctly absent,
      recent_products sorted by created_at desc, top_priced sorted by price
      desc, out_of_stock present. Gating: customer → 403, unauth → 401.
      Inventory endpoint cleared. No other backend tasks flagged for retest.

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
    working: true
    file: "frontend/app/dealer-portal.tsx + frontend/app/admin-categories.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Wrapped products list in nested ScrollView with maxHeight + overflow:hidden; removed dangling useRouter() reference in admin-categories."
      - working: true
        agent: "testing"
        comment: |
          Verified on mobile viewport (390x844) after admin OTP login (+919045666666, OTP read from MongoDB otps collection).
          A) /dealer-portal Register Sale: Products checklist renders as a contained scrollable card; on scroll the inner list scrolls independently while Purchase Date, Address (Optional), City, State all appear cleanly below with NO overlap. Screenshot dealer-portal.png + dealer-portal-scrolled.png show clean layout.
          B) /admin-categories: page loaded with default categories visible (Tiller, Plough, Harrow etc., 'Tiller' string detected). No red screen / ReferenceError. Back navigation works.
          C) /admin-products: page renders the products list cleanly with header 'Manage Products' + warranty SMS reminders + product rows. NOTE: New Product modal (X-close + Take Photo/Upload buttons) was not deeply opened in this UI test due to browser-call budget; main agent should manually spot-check the modal once.

  - task: "Notifications screen + bell card in profile"
    implemented: true
    working: true
    file: "frontend/app/notifications.tsx + frontend/app/(tabs)/profile.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: |
          PASS. Profile tab shows new 'Notifications' card with bell icon directly below Reward Points; for fresh admin it correctly displays 'You're all caught up'. Tapping navigates to /notifications which renders with header 'Notifications' and empty-state illustration + 'No notifications yet'. Back arrow returns cleanly. (Mark-all-read button visible only when unread>0; admin had 0 unread so that branch not exercised here, but the conditional render is in code.)

  - task: "Admin Service Requests screen + assign-to-manager"
    implemented: true
    working: true
    file: "frontend/app/admin-service-requests.tsx + frontend/app/(tabs)/profile.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: |
          PASS. Profile menu shows 'Service Requests' entry for admin. /admin-service-requests renders status filter pills (ALL/OPEN/IN PROGRESS/RESOLVED/CLOSED/CANCELLED) and a list of SR cards with title, customer name+phone, status pill, photo thumbnail and date. Cards correctly show either 'Assigned: <names>' or 'Unassigned — tap to assign'. NOTE: assign bottom-sheet modal toggling/Submit not exercised in UI test due to browser-call budget; backend regression already covered Assign + Notify happy path and notification fan-out.

  - task: "Admin Leads — Add Lead (call) + Assign-to-manager"
    implemented: true
    working: true
    file: "frontend/app/admin-leads.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: |
          PASS. /admin-leads renders status chips + new top-right 'Add Lead' button (testID add-lead-btn). Tapping opens the slide-up modal with all required fields ('Customer name *', 'Phone *', 'Equipment interest', 'Notes', 'Assign to managers' with All Lead Managers toggle, individual rows, Save Lead button, Cancel button). KeyboardAvoidingView present. Existing leads cards show CALL tag + Assigned line per design. Submission to backend was already validated end-to-end in /app/backend_test_session.py (admin_created lead, manager notification fan-out, Assign endpoint).

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

  - task: "Admin Inventory summary endpoint"
    implemented: true
    working: true
    file: "backend/routes/admin.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: |
          RETEST PASS after schema fix — 15/15 assertions via /app/inventory_retest.py.
          GET /api/admin/inventory/summary as admin → 200 (no more 500). Response shape verified:
          • totals.products==19 matches db.products count.
          • by_category list has exactly 10 registered rows (one per seeded category), each with
            {id, name, key, icon, products_count, in_stock_count, out_of_stock_count,
            avg_price, total_value, active}.
          • name populated from category.label for every row.
          • For each non-empty category, total_value == sum(prices) and avg_price == total_value/products_count (verified against DB).
          • _uncategorised bucket correctly absent (all product categories are in registered keys).
          • recent_products sorted by created_at desc; top_priced sorted by price desc
            ([245000,198000,185000,165000,115000]); out_of_stock array present.
          Gating: customer token → 403; unauth → 401. Schema mismatch fix (c["name"] → c.get("key")/c.get("label")) confirmed.
      - working: false
        agent: "testing"
        comment: |
          GET /api/admin/inventory/summary returns **500 Internal Server Error**.
          Backend traceback (in /var/log/supervisor/backend.err.log):
            File "/app/backend/routes/admin.py", line 86, in inventory_summary
              {"category": c["name"]}, {"_id": 0, "price": 1, "in_stock": 1, "id": 1},
                           ~^^^^^^^^
            KeyError: 'name'
          Root cause: the `categories` collection has fields {id, key, label, icon,
          sort_order, active} — there is NO `name` field. Products store
          `category` as the category KEY (e.g. "Tiller"). Lines 81, 86, and 94
          in admin.py reference `c["name"]` / `c.get("name")` which evaluates to
          None or KeyError.
          Auth (admin OTP) and 403-for-non-admin both work; only the body assembly
          crashes.
          FIX: replace `c["name"]` / `c.get("name")` with `c.get("key")` (or
          `c.get("label")` for the response display name) inside the
          inventory_summary route. After fix:
            cat_names = {c.get("key") for c in cats}
            await db.products.find({"category": c["key"]}, ...)
            "name": c.get("label", c.get("key")),
          Also update by_category row 'name' field accordingly so the response
          shape `{id, name, icon, ...}` actually populates name from the category
          label.

  - task: "Admin Product reorder endpoint"
    implemented: true
    working: true
    file: "backend/routes/admin.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: |
          PASS via /app/backend_test_inventory.py (8/8 reorder assertions).
          GET /products baseline returned 19 products; POST /admin/products/reorder
          {ordered_ids:<reversed>} -> 200 with list response. Subsequent GET /products
          order matched the reversed input exactly. Every product doc has a
          `sort_order` field after reorder. Idempotent re-POST same payload -> 200.
          Customer token -> 403. Admin restored to original order at end. Sort
          regression: POSTed a brand-new product with no sort_order; two consecutive
          GET /products calls returned identical ordering (deterministic) and the
          new product appears at index 0/20 (since missing sort_order < positive
          values when ascending).

  - task: "Lead referral & loyalty points system"
    implemented: true
    working: true
    file: "backend/services/loyalty.py + backend/routes/loyalty.py + backend/routes/admin.py + backend/routes/orders.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: false
        agent: "testing"
        comment: "Previously: PATCH /admin/leads/{id} status=purchased for admin-created lead returned 400 'User not found' because loyalty.update_lead_status tried to adjust_points('') when referrer_user_id was empty."
      - working: true
        agent: "testing"
        comment: |
          Retest after loyalty.py fix (guard `and lead.get('referrer_user_id')` on line 116) — 9/9 assertions PASS via /app/backend_test_retest.py.
          1) POST /api/admin/leads {name:'Retest Caller', phone:'+919999000333', manager_ids:[], all_managers:false} → 200. Response has admin_created=True, referrer_user_id='', assigned_manager_ids=[].
          2) PATCH /api/admin/leads/{lead_id} {status:'purchased', notes:''} → 200 (previously 400). status='purchased', points_awarded=0 (no payout because referrer_user_id is empty).
          3) Sanity payout path: customer ramesh logged in, submitted lead '+919877777701', admin marked purchased → points_awarded=500, referrer balance went 0→500 (delta=+500). Referral payout still works correctly.
          4) GET /api/admin/leads confirms retest lead has status='purchased'.
          No 5xx. Fix verified.

  - task: "Billing Phase 3+4+5(stub)+7 — DC, Gate Pass, Vendors, PO, Reports, e-Way Bill stub"
    implemented: true
    working: true
    file: "backend/routes/billing_extended.py + backend/services/pdfgen.py + backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: |
          Full regression of Phase 3+4+5(stub)+7 via /app/backend_test_billing_ext.py — **68/68 PASS, zero 5xx**.

          A) VENDORS (9/9): GET /vendors 200; POST {Acme Steels, 27ABCDE1234F1Z5, state_code=27, phone 9988776655} → 200 with state_code=27 AND pan=ABCDE1234F auto-derived from GSTIN; POST invalid "BADGSTIN" → 400 "Invalid GSTIN format"; PATCH phone=9000000000 → 200 updated; GET list contains vendor; DELETE → 200 {ok:true}.

          B) DELIVERY CHALLANS (10/10): Chose/created a UP customer (state_code=09) for intra-state validation. POST DC (Tiller TMX-50 qty 2 @48500, gst 5%, apply_gst=true, vehicle UP14AB1234, driver Ramesh) → 200 with number=HANSA/2026-27/DC/0001, totals.intra_state=true, cgst=sgst=2425 (5% split 50/50), grand_total=101850. POST DC apply_gst=false (job-work) → cgst=sgst=igst=0 and grand_total=97000 = qty*rate. GET list contains both. GET /delivery-challans/{id}/pdf → 200 application/pdf, body starts %PDF-1.4, 3432 bytes. DELETE → 200.

          C) GATE PASSES (9/9): POST {ref_type=delivery_challan, ref_id=DC_id, direction=outward} → 200 number HANSA/2026-27/GP/0001; party_name auto-pulled from DC.buyer.name; items_summary auto-populated as "Tiller TMX-50 x2.0"; vehicle_no UP14AB1234 inherited from DC. POST manual {ref_type=manual, party_name=Test Co, items_summary=5 cartons, vehicle_no=UP14XY1234} → 200 fields persisted. GET list contains both. GET /gate-passes/{id}/pdf → 200 application/pdf %PDF- 2495 bytes.

          D) PURCHASE ORDERS (7/7): Recreated vendor (MH 27), POST PO {MS Plate qty 100 @80, gst 18%, expected_delivery 2026-06-15} → 200 number HANSA/2026-27/PO/0001. Since supplier state=27 (MH) ≠ buyer state=09 (UP), totals.intra_state=false and IGST=1440, CGST=SGST=0 ✓. GET list contains PO. GET /purchase-orders/{id}/pdf → 200 application/pdf %PDF- 3392 bytes.

          E) e-WAY BILL stub (5/5): POST /invoices/{iid}/eway-bill {171234567890, 2026-05-03, UP14AB1234, Road} → 200 with invoice.eway_bill_no set and eway_bill_status="manual". POST /invoices/{iid}/generate-eway → 503 with detail "e-Way Bill GSP not configured. Provide credentials in backend/.env..." ✓. POST /invoices/non-existent-id/eway-bill → 404.

          F) REPORTS (13/13): /reports/sales-register 200 with rows[] + totals{count,taxable,cgst,sgst,igst,grand_total}. Date-range 1900-01-01..02 → empty rows, all totals zero. /reports/customer-ledger?customer_id=<valid> 200 with customer object, entries[] sorted by date ascending, summary{invoices_count,quotations_count,delivery_challans_count,total_invoiced}. /customer-ledger?customer_id=invalid-id → 404 "Customer not found". /reports/aging 200 with rows[], buckets {0-30,31-60,61-90,90+}, total_outstanding numeric (135150.0). /reports/gstr1?period=052026 → 200 with summary{period:"052026", invoices_count:2, b2b_count:2, ...} and json{gstin:"09AAOCR7303L1ZU", fp:"052026", b2b[], b2cl[], b2cs[], hsn:{data:[]}} — full GSTN offline-tool shape validated. /reports/gstr1 no-period → 200, defaults to current month (052026) ✓.

          G) AUTH GATING (11/11): All 7 representative endpoints (vendors, DCs, gate-passes, POs, reports sales-register/aging/gstr1) with no token → 401. Customer token (ramesh@farm.com legacy) → 403 on vendors, delivery-challans, purchase-orders, reports/sales-register.

          No 5xx observed anywhere in the run. The feature is fully operational. Note: PDF generation is working correctly for all new doc kinds (DC, GP, PO) — reportlab layout fix from prior iteration covers these too.
      - working: "NA"
        agent: "main"
        comment: |
          Built Phase 3+4+5(stub)+7 routes under /api/admin/billing/*:
          • Vendors:    GET/POST/PATCH/DELETE /vendors  (GSTIN-aware, similar to customers)
          • DC:         GET/POST/DELETE /delivery-challans  + GET /delivery-challans/{id}/pdf
                        Body: customer_id, items[], purpose (sale|job-work|sample|approval|return),
                        apply_gst toggle, vehicle/driver fields, optional invoice_id link.
                        Numbering HANSA/<FY>/DC/0001.
          • Gate Pass:  GET/POST/DELETE /gate-passes  + GET /gate-passes/{id}/pdf
                        ref_type ∈ {invoice|delivery_challan|manual}; auto-pulls party_name +
                        items_summary from referenced doc. Numbering HANSA/<FY>/GP/0001.
          • PO:         GET/POST/DELETE /purchase-orders  + GET /purchase-orders/{id}/pdf
                        GST-aware (vendor state vs our state) — IGST when inter-state,
                        CGST+SGST when intra-state. Numbering HANSA/<FY>/PO/0001.
          • e-Way Bill: POST /invoices/{id}/eway-bill  (manual entry persisted)
                        POST /invoices/{id}/generate-eway → 503 with friendly stub message
                        ("provide GSP creds in backend/.env"). Wire-up pending user creds.
          • Reports:
              GET /reports/sales-register?date_from&date_to → rows + totals
              GET /reports/customer-ledger?customer_id     → entries + summary
              GET /reports/aging                            → buckets 0-30/31-60/61-90/90+
              GET /reports/gstr1?period=MMYYYY              → {summary, json:{b2b,b2cl,b2cs,hsn}}
                                                              (gov-spec JSON for offline tool)

          PDF gen extended: render_billing_doc supports new doc_kinds 'delivery_challan' and
          'purchase_order' (PO swaps party labels: From=Us, Vendor block, Deliver-To=Us).
          New render_gate_pass() generates a single-page security-friendly Gate Pass with
          big direction header + party/vehicle/driver block + items-summary + 3 signature
          blocks (Issued/Security/Receiver).

          Wired billing_extended router into backend/server.py.
    implemented: true
    working: true
    file: "backend/routes/billing.py + backend/services/gst.py + backend/services/pdfgen.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "testing"
        comment: |
          PDF retest after pdfgen.py layout fix — both endpoints now return 200 with valid multi-KB PDFs.
          Verified via /app/billing_pdf_retest.py:
          • GET /api/admin/billing/quotations/{id}/pdf → 200, Content-Type=application/pdf, 3427 bytes, body starts with %PDF-1.4.
          • GET /api/admin/billing/invoices/{id}/pdf → 200, Content-Type=application/pdf, 3423 bytes, body starts with %PDF-1.4.
          • Sanity: GET /api/admin/billing/quotations → 200 (4 quotations); GET /api/admin/billing/invoices → 200 (2 invoices). List endpoints unaffected.
          The previous reportlab `negative availWidth=-12` ValueError is resolved (header_row now uses colWidths=[110mm,72mm] with title_cell wrapper). Both PDFs render header + party-block + items-table + totals + signature successfully.
      - working: false
        agent: "testing"
        comment: |
          53/55 PASS via /app/backend_test_billing.py. All CRUD, GST math
          (intra-state CGST+SGST, inter-state IGST), numbering integrity
          (HANSA/FY/QUO|INV/NNNN increments cleanly), quotation->invoice
          conversion, amount_in_words, and auth gating (401/403) verified.
          CRITICAL: both PDF endpoints
          (GET /admin/billing/quotations/{id}/pdf and
          GET /admin/billing/invoices/{id}/pdf) return **500** due to a
          reportlab layout bug in services/pdfgen.py:229. The outer wrapper
          `Table([[party_table, meta_table]], colWidths=[180*mm, 0])` has a
          zero-width second column, and the inner party_table (3x60mm=180mm)
          fully fills the first 180mm column — after outer Table's
          LEFTPADDING+RIGHTPADDING=12pt the child flowable is given
          availWidth=-12 and reportlab raises ValueError. Fix: set the
          outer colWidths to e.g. [105*mm, 77*mm] AND shrink inner
          party_table colWidths to fit (e.g. [33,34,34]*mm). All other
          billing functionality is correct.

frontend:
  - task: "Admin Billing UI (Phase 1+2 — Customers / Quotations / Tax Invoices) + Company Settings"
    implemented: true
    working: true
    file: "frontend/app/admin-billing.tsx + frontend/app/admin-company-settings.tsx + frontend/src/api.ts"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: true
        agent: "main"
        comment: |
          Fixed missing `formatINR` export in src/api.ts (admin-billing.tsx
          imported it but it didn't exist — would have crashed on import).
          Verified both /admin-billing and /admin-company-settings render
          cleanly via screenshot tool at 390×844 viewport. Billing screen
          shows 3-tab pill row (INVOICES/QUOTATIONS/CUSTOMERS), header back
          + Company Settings business icon, "New Tax Invoice" CTA, and
          empty state. Company Settings shows all 20 fields (Legal Name,
          GSTIN, PAN, CIN, Address, City, State, State Code, Pincode,
          Phone, Email, Website, Bank Name, A/c, IFSC, Branch, Invoice
          Prefix, Default T&C) + Save button. Wired into Admin profile
          menu via /(tabs)/profile.tsx. Backend already verified at 55/55
          PASS incl. PDF retest 4/4 PASS in earlier session.

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


  - agent: "testing"
    message: |
      "Remarks/timeline + dealer assignment + manager perms expansion" regression
      via /app/backend_test_remarks.py against the public preview URL. RESULT:
      **58 PASS / 0 FAIL, zero 5xx**.

      A) Manager perms expansion (PASS): POST /admin/managers with all 4 perms
         (leads/service/warranty/points=true) -> 200; response.manager_perms has
         all 4 keys=true. PATCH to {leads:T, service:F, warranty:F, points:F} ->
         200 perms updated. PATCH all-false -> 400 "At least one permission must
         be enabled". Restored to all 4 true.
      B) Dealer-assigned leads + SRs (PASS): GET /admin/dealer-users returned 2
         dealer users (d1, d2). Customer ramesh POST /leads created referral
         lead. Admin POST /admin/leads/{id}/assign-dealers {[d1], note} ->
         assigned_dealer_user_ids=[d1], timeline got entry with action=
         "assigned_to_dealers (1)" + remark="Please call ASAP", d1 received
         in-app notification type=lead_assigned ref_id=lead_id. Re-POST with
         all_dealers=true assigned BOTH dealer ids. SR with title="Hydraulic
         leak"+jpg created; admin assign-dealers to d1 with note=Onsite check
         -> SR timeline grew, d1 notified type=service_assigned. Empty
         dealer_user_ids+all_dealers:false -> 200 with assigned_dealer_user_ids
         =[] (cleared), no new notif sent.
      C) Dealer endpoints (PASS): logged in as actual dealer d1 via OTP.
         GET /dealer/leads contained the assigned lead. PATCH /dealer/leads/{id}
         {status:contacted, remark} -> status=contacted, last timeline entry
         has remark + action="status: new → contacted". PATCH to purchased with
         remark="Bought tiller" -> ramesh balance went 500 → 1000 (+500
         referral payout) and timeline entry recorded. GET /dealer/service-
         requests contained SR; PATCH {status:in_progress, remark:"Tech on the
         way"} -> SR.status=in_progress, timeline grew, ramesh got
         service_status in-app notification. Negative: dealer PATCHing a lead
         not assigned to them -> 404 "Lead not assigned to you".
      D) Manager warranty + points (PASS): logged in as M-All manager via OTP.
         POST /manager/assign-warranty (1 product, customer +919998880050) ->
         200; the inserted order has assigned_by_dealer == manager.id (the
         service code uses 'assigned_by_dealer' for non-admin actors). POST
         /manager/points/adjust {user_id:ramesh, delta:+25, reason:"Manual
         award"} -> 200, new_balance == before+25 (1000 → 1025). Ramesh
         received in-app notif type=points_adjust title="Reward Points
         credited". Negative: PATCH M-All to remove perms_warranty, retry
         /manager/assign-warranty -> 403 "Warranty management permission
         required". Perms restored.
      E) Admin lead PATCH with remark (PASS): admin creates lead, PATCHes
         {status:contacted, remark:"Caller asked for more info"} -> 200;
         timeline has entry with remark="Caller asked for more info" and
         role="admin".
      F) Cleanup (PASS): DELETE /admin/managers/{M-All_id} -> 200.

      Backend logs clean throughout (no 5xx). All assertions in the review
      request verified end-to-end. No further backend retest required for
      this batch.

  - agent: "testing"
    message: |
      Inventory + Product Reorder regression via /app/backend_test_inventory.py
      against the public preview URL. RESULT: **22 PASS / 1 FAIL**.

      A) Inventory summary — **FAIL (CRITICAL)**: GET /api/admin/inventory/summary
         returns **500 Internal Server Error**. Backend traceback:
           File "/app/backend/routes/admin.py", line 86, in inventory_summary
               {"category": c["name"]}, ...
           KeyError: 'name'
         Root cause: the categories collection has fields {id, key, label, icon,
         sort_order, active} — there is NO `name` field. Products store `category`
         as the category KEY (e.g. "Tiller"). Lines 81, 86 and 94 of admin.py
         reference c["name"]/c.get("name") which raises KeyError. Fix: replace
         c["name"] / c.get("name") with c.get("key") for matching products and
         use c.get("label", c.get("key")) for the response display name.
         Auth gating works correctly: admin OTP login is fine, customer token
         correctly receives 403 on this endpoint — only the body assembly crashes.

      B) Product reorder — **PASS** (8/8 assertions):
         - GET /products baseline returned 19 products.
         - POST /admin/products/reorder {ordered_ids:<reversed>} -> 200 with list response.
         - Subsequent GET /products order matched the reversed input EXACTLY.
         - Every product doc now has a `sort_order` field after reorder.
         - Idempotent re-POST same payload -> 200.
         - POST as customer token -> 403 (gating correct).
         - Restored original order at end.

      C) Sort regression — **PASS**:
         - POSTed a brand-new admin product with no sort_order. Two consecutive
           GET /products calls returned identical ordering (deterministic). New
           product appears at index 0/20 (Mongo treats missing sort_order as
           lowest in ascending sort). Cleaned up after.

      D) Smoke regression — **PASS**:
         - GET /manager/me as admin -> 200, manager_perms includes
           {leads:true, service:true, warranty:true, points:true}.
         - POST /manager/assign-warranty (1 product, dummy phone +919998880077)
           as admin -> 200 with order created.
         - POST /manager/points/adjust {user_id:ramesh, delta:5, reason:"smoke"}
           as admin -> 200 with new_balance=1030.

      ACTION FOR MAIN AGENT: Fix the c["name"] -> c.get("key") in
      /app/backend/routes/admin.py:81,86,94 (inventory_summary). Until that is
      fixed, the new admin Inventory dashboard cannot load any data.

  - agent: "testing"
    message: |
      N+1 optimization smoke test — /app/backend_test_n1_smoke.py — **10/10 PASS, zero 5xx**.
      Behavior is identical to pre-optimization:
      1) GET /api/admin/inventory/summary (admin +919045666666) -> 200. Response keys
         exactly {totals, by_category, recent_products, top_priced, out_of_stock}.
         totals has {products, categories, featured, in_stock, out_of_stock, total_value_inr}.
         by_category length = 10 (one per registered category); every row has
         products_count/avg_price/total_value (plus id/name/key/icon/active/in_stock_count/out_of_stock_count).
         Note: code now uses single `db.products.find({}).to_list(5000)` + in-memory
         bucketing (was one `.find({"category": key})` per category) — results match.
      2) GET /api/admin/dealer-users -> 200 with 2 dealer users. Both have `dealer_id`;
         both dealer_ids resolve to existing dealer docs; both users have populated
         `dealer_profile` with `name` and `city`. Batched `$in` query works.
      3) POST /api/admin/leads {name, phone:+919555000111, manager_ids:[mgr],
         all_managers:false, source:"call"} -> 200. admin_created=True, source="call",
         assigned_manager_ids matches request. Unchanged flow.
      4) GET /api/manager/me (admin) -> 200. role="admin", perms={leads:true,
         service:true, warranty:true, points:true} (super-manager default).
      No 5xx in backend logs during the run. N+1 -> batched optimization did not
      alter behavior or response shape. No further retest required.

  - agent: "testing"
    message: |
      HANSA Billing Phase 1+2 regression via /app/backend_test_billing.py —
      **53 PASS / 2 FAIL**. Admin OTP login with +919045666666 works.

      A) Company settings (PASS 8/8):
         - GET /api/admin/billing/company → 200, auto-seeded with RAMKISHAN
           AGRI INNOVATE PRIVATE LIMITED, gstin=09AAOCR7303L1ZU, state_code=09,
           city=Meerut. PUT with edited trade_name/default_terms persisted.
           PUT with gstin="INVALID" → 400.
      B) Customer master (PASS 12/12): UP customer → billing_state_code=09,
         pan=ABCDE1234F derived from GSTIN; MH customer (27ABCDE1234F1Z5) →
         billing_state_code=27; invalid GSTIN → 400; list contains both;
         PATCH + DELETE 200.
      C) Catalog helper (PASS 3/3): 19 items, each has
         {hsn_code, gst_rate, unit, rate}.
      D) Quotation (PASS 10/11):
         - POST quotation UP→UP → 200 number "HANSA/2026-27/QUO/0001",
           totals.intra_state=true, cgst=2375 sgst=2375 igst=0,
           amount_in_words="Rupees Ninety-Nine Thousand Seven Hundred And
           Fifty Only".
         - GET /quotations contains it.
         - **FAIL D8**: GET /quotations/{id}/pdf → **500 Internal Server Error**
           (reportlab ValueError: nested Table has colWidths=[180mm, 0]; the
           party_table+meta_table outer wrapper gives the meta column 0 width,
           then inner party_table at 60mm×3 = 180mm exceeds outer cell width
           after leftPadding/rightPadding=6, producing "negative
           availWidth=-12").
         - POST /quotations/{id}/convert → 200, invoice number
           "HANSA/2026-27/INV/0001", quotation.status="converted".
      E) Tax Invoice inter-state (PASS 7/8):
         - POST /invoices (MH customer, gst 18%) → 200, totals.intra_state=false,
           igst=5400, cgst=0, sgst=0, number="HANSA/2026-27/INV/0002"
           (incremented by +1 from converted INV/0001).
         - **FAIL E7**: GET /invoices/{id}/pdf → **500** (same reportlab
           layout bug as D8).
         - GET /invoices list contains both.
      F) Numbering integrity (PASS): 3 quick QUOs returned sequences [2,3,4]
         cleanly — no gaps.
      G) Negative auth (PASS 11/11): no-auth → 401, customer token → 403 on
         all /admin/billing/* endpoints (GET + POST).

      ## CRITICAL FAIL — PDF endpoints
      Backend log traceback:
        File "/app/backend/services/pdfgen.py", line 237, in render_billing_doc
          pdf.build(story)
        ...
        ValueError: <Table ... 1 rows x 2 cols ...> with cell(0,0) containing
          "<Table ... 2 rows x 3 cols ...>": flowable given negative
          availWidth=-12 == width=0 - leftPadding=6 - rightPadding=6
      Root cause: pdfgen.py:229 calls
        `Table([[party_table, meta_table]], colWidths=[180 * mm, 0])`
      The second column has **width 0** but contains `meta_table`; and the
      first column (180mm) nests `party_table` built with `colWidths=[60mm,
      60mm, 60mm]` = exactly 180mm, so after the outer Table's
      LEFTPADDING/RIGHTPADDING=6pt is applied the available width for the
      child flowable becomes -12pt → reportlab raises and the route returns
      500. BOTH quotation and invoice PDF endpoints are affected.

      SUGGESTED FIX (main agent):
      - Change line 229 wrapper to use explicit widths that sum to
        (width - 2*margin) = ~182mm, e.g.
          Table([[party_table, meta_table]], colWidths=[105*mm, 77*mm])
        AND reduce party_table column widths to fit that 105mm cell
        (e.g. colWidths=[33*mm, 34*mm, 34*mm]).
      - Or remove the outer wrapper and place party_table and meta_table as
        sibling flowables / use two separate rows.
      Also the footer Table at line 218 has colWidths=[110mm, 60mm]=170mm
      (within 182mm frame) which is fine, but the totals row at line 233
      uses [100mm, 75mm]=175mm which is fine.

      Everything except PDF rendering works. Data persistence, GST math,
      numbering, conversion, auth gating are all correct.

  - agent: "testing"
    message: |
      Quick regression after frontend-integration session — /app/backend_test.py
      ALL 16 assertions PASS, zero 5xx.

      1) Manager CRUD with 4 perms: POST /admin/managers {+919999300011,
         leads/service/warranty/points=true} → 200 with all four perms true.
         PATCH {leads:T, service:F, warranty:T, points:F} → 200 saved correctly.
         DELETE → 200 {demoted:true}. PASS.
      2) Lead PATCH backward-compat: ramesh POST /leads → 200. Admin PATCH
         /admin/leads/{id} {status:"contacted", notes:"old field works"} → 200,
         last timeline entry remark="old field works". PATCH {status:"lost",
         remark:"new remark field works"} → 200, timeline grew to len=3 with
         matching remark. Both `notes` (legacy alias) and `remark` (new) work.
         PASS.
      3) Dealer regression: GET /admin/dealer-users returned 2 dealer users;
         logged in via OTP (pulled `code` field from otps collection).
         GET /dealer/leads → 200 count=1. PATCH /dealer/leads/{id}
         {status:"contacted", notes:...} → 200 remark set. PATCH
         {status:"contacted", remark:...} → 200 remark updated. Both
         notes/remark formats accepted. PASS.
      4) Admin assign-dealers: POST /admin/leads/{id}/assign-dealers
         {dealer_user_ids:[d1], note:"test"} → 200 with
         assigned_dealer_user_ids=[d1], timeline_len=2. GET /admin/dealer-users
         admin=200 (count=2), non-admin ramesh=403. Note: the review mentioned
         "POST /api/admin/dealer-users" but the current implementation only has
         GET (see routes/admin.py:349). GET works with proper admin gating;
         confirm with main agent whether a POST variant was intended.
      5) Backwards-compat: PATCH /manager/service-requests/{sr_id}
         {status:"in_progress", note:"works", resolution:""} with admin token
         → 200, last timeline entry remark="works" (note alias accepted via
         ServiceUpdateIn schema). PASS.

      No 5xx observed. No further backend retest required for these
      assertions.


  - agent: "testing"
    message: |
      Billing PDF retest after layout fix — **ALL 4 CHECKS PASS**, zero 5xx.
      Ran /app/billing_pdf_retest.py against the public preview URL with admin OTP login (+919045666666).
      1) GET /api/admin/billing/quotations/{id}/pdf → 200, Content-Type=application/pdf, 3427 bytes (>1000), body starts with %PDF-1.4. ✅
      2) GET /api/admin/billing/invoices/{id}/pdf → 200, Content-Type=application/pdf, 3423 bytes (>1000), body starts with %PDF-1.4. ✅
      3) GET /api/admin/billing/quotations → 200 (4 quotations listed). ✅
      4) GET /api/admin/billing/invoices → 200 (2 invoices listed). ✅
      The previous reportlab `negative availWidth=-12` ValueError is fully resolved (header_row uses colWidths=[110mm,72mm] with title_cell wrapper instead of the broken [180mm,0]). Both PDFs render header + meta + party-block + items-table + totals + signature. Billing feature cleared; no further retest required.

  - agent: "testing"
    message: |
      HANSA Billing Phase 3+4+5(stub)+7 regression via /app/backend_test_billing_ext.py
      against the public preview URL — **68 PASS / 0 FAIL, zero 5xx**.

      A) Vendors (9/9): CRUD fully working. POST with GSTIN 27ABCDE1234F1Z5
         auto-derived pan=ABCDE1234F and state_code=27. Invalid "BADGSTIN"
         → 400. PATCH phone, GET list contains, DELETE → {ok:true}.
      B) Delivery Challans (10/10): POST with apply_gst=true (UP→UP) → 200,
         number HANSA/2026-27/DC/0001, intra_state=true, cgst=sgst=2425,
         grand_total=101850. POST apply_gst=false (job-work) → cgst=sgst=
         igst=0, grand_total=qty*rate=97000. GET list, PDF (3432 bytes,
         %PDF-1.4), DELETE all PASS.
      C) Gate Passes (9/9): ref_type=delivery_challan auto-pulls party_name
         ("Ramesh Singh Farms") from DC.buyer, items_summary ("Tiller
         TMX-50 x2.0"), vehicle_no (UP14AB1234). Manual GP persists
         explicit fields. PDF application/pdf %PDF- (2495 bytes).
      D) Purchase Orders (7/7): POST with Maharashtra vendor (state 27) +
         our state 09 → intra_state=false, IGST=1440, CGST=SGST=0.
         Number HANSA/2026-27/PO/0001. PDF 3392 bytes.
      E) e-Way Bill stub (5/5): POST /invoices/{iid}/eway-bill → 200 with
         eway_bill_no persisted and eway_bill_status="manual". POST
         /invoices/{iid}/generate-eway → 503 "e-Way Bill GSP not
         configured. Provide credentials in backend/.env (EWAY_GSP_PROVIDER,
         EWAY_USERNAME, EWAY_PASSWORD, EWAY_CLIENT_ID, EWAY_CLIENT_SECRET)".
         Non-existent invoice id → 404.
      F) Reports (13/13): sales-register 200 with rows[] + totals{count,
         taxable, cgst, sgst, igst, grand_total}. Empty date window 1900
         returns zeroed totals. customer-ledger(valid) 200 with customer,
         entries sorted by date, summary{invoices/quotations/dc counts,
         total_invoiced}. customer-ledger(invalid) → 404 "Customer not
         found". aging 200 with rows[], buckets {0-30,31-60,61-90,90+},
         numeric total_outstanding. gstr1?period=052026 → 200 with
         summary{period:"052026", invoices_count:2, b2b_count:2, ...} and
         json{gstin:"09AAOCR7303L1ZU", fp:"052026", b2b[], b2cl[], b2cs[],
         hsn:{data:[]}} — full GSTN offline-tool shape. gstr1 no-period
         defaults to current month (052026) correctly.
      G) Auth gating (11/11): no-token → 401 on 7 representative endpoints.
         Customer token → 403 on vendors, DCs, POs, reports/sales-register.

      Feature cleared. No 5xx in backend logs. No further retest required.
