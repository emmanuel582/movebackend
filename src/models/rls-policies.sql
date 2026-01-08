-- Add RLS policies for verifications table

-- Policy: Users can insert their own verification records
create policy "Users can submit own verification" 
on verifications 
for insert 
with check (auth.uid() = user_id);

-- Policy: Users can view their own verification records
create policy "Users can view own verifications" 
on verifications 
for select 
using (auth.uid() = user_id);

-- Add policies for other tables

-- Trips policies
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

create policy "Users can update own trips" 
on trips 
for update 
using (auth.uid() = user_id);

create policy "Users can delete own trips" 
on trips 
for delete 
using (auth.uid() = user_id);

-- Delivery requests policies
create policy "Users can insert own delivery requests" 
on delivery_requests 
for insert 
with check (auth.uid() = user_id);

create policy "Users can view own delivery requests" 
on delivery_requests 
for select 
using (auth.uid() = user_id);

create policy "Anyone can view pending delivery requests" 
on delivery_requests 
for select 
using (status = 'pending');

create policy "Users can update own delivery requests" 
on delivery_requests 
for update 
using (auth.uid() = user_id);

-- Wallets policies (user_id exists in wallets table)
create policy "Users can view own wallet" 
on wallets 
for select 
using (auth.uid() = user_id);

create policy "Users can update own wallet" 
on wallets 
for update 
using (auth.uid() = user_id);

-- Notifications policies
create policy "Users can view own notifications" 
on notifications 
for select 
using (auth.uid() = user_id);

create policy "Users can update own notifications" 
on notifications 
for update 
using (auth.uid() = user_id);

-- Payments policies (uses business_id and traveler_id)
create policy "Users can view own payments" 
on payments 
for select 
using (auth.uid() = business_id or auth.uid() = traveler_id);

-- Ratings policies
create policy "Users can insert ratings" 
on ratings 
for insert 
with check (auth.uid() = rater_id);

create policy "Anyone can view ratings" 
on ratings 
for select 
using (true);

create policy "Users can view ratings about them" 
on ratings 
for select 
using (auth.uid() = rated_id or auth.uid() = rater_id);

-- Matches policies (uses traveler_id and business_id)
create policy "Users can view own matches" 
on matches 
for select 
using (auth.uid() = traveler_id or auth.uid() = business_id);

create policy "Users can insert match requests" 
on matches 
for insert 
with check (auth.uid() = business_id or auth.uid() = traveler_id);

create policy "Users can update own matches" 
on matches 
for update 
using (auth.uid() = traveler_id or auth.uid() = business_id);

-- Withdrawals policies
create policy "Users can view own withdrawals" 
on withdrawals 
for select 
using (auth.uid() = user_id);

create policy "Users can insert own withdrawals" 
on withdrawals 
for insert 
with check (auth.uid() = user_id);

-- Disputes policies
create policy "Users can view own disputes" 
on disputes 
for select 
using (auth.uid() = raised_by);

create policy "Users can insert disputes" 
on disputes 
for insert 
with check (auth.uid() = raised_by);
