-- SIMPLE RLS POLICIES - Run these one section at a time to find the error

-- ============================================
-- SECTION 1: VERIFICATIONS (Run this first)
-- ============================================
create policy "Users can submit own verification" 
on verifications 
for insert 
with check (auth.uid() = user_id);

create policy "Users can view own verifications" 
on verifications 
for select 
using (auth.uid() = user_id);

-- ============================================
-- SECTION 2: TRIPS (Run this second)
-- ============================================
create policy "Users can insert own trips" 
on trips 
for insert 
with check (auth.uid() = user_id);

create policy "Users can view own trips" 
on trips 
for select 
using (auth.uid() = user_id);

create policy "Anyone can view active trips" 
on trips 
for select 
using (status = 'active');

-- ============================================
-- SECTION 3: DELIVERY REQUESTS (Run this third)
-- ============================================
create policy "Users can insert own delivery requests" 
on delivery_requests 
for insert 
with check (auth.uid() = user_id);

create policy "Users can view own delivery requests" 
on delivery_requests 
for select 
using (auth.uid() = user_id);

-- ============================================
-- SECTION 4: WALLETS (Run this fourth)
-- ============================================
create policy "Users can view own wallet" 
on wallets 
for select 
using (auth.uid() = user_id);

-- ============================================
-- SECTION 5: NOTIFICATIONS (Run this fifth)
-- ============================================
create policy "Users can view own notifications" 
on notifications 
for select 
using (auth.uid() = user_id);

-- ============================================
-- SECTION 6: PAYMENTS (Run this sixth)
-- ============================================
create policy "Users can view own payments" 
on payments 
for select 
using (auth.uid() = business_id or auth.uid() = traveler_id);

-- ============================================
-- SECTION 7: RATINGS (Run this seventh)
-- ============================================
create policy "Users can insert ratings" 
on ratings 
for insert 
with check (auth.uid() = rater_id);

create policy "Anyone can view ratings" 
on ratings 
for select 
using (true);

-- ============================================
-- SECTION 8: MATCHES (Run this eighth)
-- ============================================
create policy "Users can view own matches" 
on matches 
for select 
using (auth.uid() = traveler_id or auth.uid() = business_id);

-- ============================================
-- SECTION 9: WITHDRAWALS (Run this ninth)
-- ============================================
create policy "Users can view own withdrawals" 
on withdrawals 
for select 
using (auth.uid() = user_id);

-- ============================================
-- SECTION 10: DISPUTES (Run this tenth)
-- ============================================
create policy "Users can view own disputes" 
on disputes 
for select 
using (auth.uid() = raised_by);
