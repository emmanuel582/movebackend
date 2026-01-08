-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Users Table
create table users (
  id uuid primary key references auth.users on delete cascade,
  email text unique not null,
  phone text unique,
  full_name text,
  user_type text check (user_type in ('traveler', 'business', 'both')),
  current_mode text default 'traveler',
  is_verified boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Verifications Table
create table verifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade not null,
  verification_type text check (verification_type in ('identity', 'business')),
  nin_bvn text,
  id_document_url text,
  live_video_url text,
  live_photo_url text,
  cac_number text,
  business_address text,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_notes text,
  reviewed_by uuid references users(id),
  reviewed_at timestamp with time zone,
  submitted_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Trips Table
create table trips (
  id uuid primary key default uuid_generate_v4(),
  traveler_id uuid references users(id) on delete cascade not null,
  origin text not null,
  destination text not null,
  departure_date date not null,
  departure_time time,
  available_space text check (available_space in ('small', 'medium', 'large')),
  description text,
  status text default 'active' check (status in ('active', 'completed', 'cancelled')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Delivery Requests Table
create table delivery_requests (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid references users(id) on delete cascade not null,
  origin text not null,
  destination text not null,
  package_size text check (package_size in ('small', 'medium', 'large')),
  delivery_date date,
  item_description text,
  estimated_cost decimal(10, 2),
  status text default 'pending' check (status in ('pending', 'matched', 'in_transit', 'delivered', 'cancelled')),
  traveler_name text, -- De-normalized for quick dashboard view if needed, or join with matches
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Matches Table
create table matches (
  id uuid primary key default uuid_generate_v4(),
  trip_id uuid references trips(id),
  delivery_request_id uuid references delivery_requests(id),
  traveler_id uuid references users(id) not null,
  business_id uuid references users(id) not null,
  status text default 'pending' check (status in ('pending', 'accepted', 'declined', 'pickup_confirmed', 'delivery_confirmed', 'completed', 'disputed')),
  pickup_otp text,
  delivery_otp text,
  pickup_confirmed_at timestamp with time zone,
  delivery_confirmed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Payments Table
create table payments (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid references matches(id),
  business_id uuid references users(id),
  traveler_id uuid references users(id),
  amount decimal(10, 2) not null,
  commission decimal(10, 2) not null,
  traveler_earnings decimal(10, 2) not null,
  payment_reference text unique not null,
  payment_status text default 'pending',
  paid_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Wallets Table
create table wallets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) unique not null,
  balance decimal(10, 2) default 0.00,
  total_earned decimal(10, 2) default 0.00,
  total_withdrawn decimal(10, 2) default 0.00,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Withdrawals Table
create table withdrawals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) not null,
  amount decimal(10, 2) not null,
  bank_name text not null,
  account_number text not null,
  status text default 'pending',
  withdrawal_reference text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ratings Table
create table ratings (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid references matches(id),
  rater_id uuid references users(id),
  rated_id uuid references users(id),
  rating integer check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Disputes Table
create table disputes (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid references matches(id),
  raised_by uuid references users(id),
  against_user uuid references users(id),
  reason text not null,
  status text default 'open',
  resolution text,
  resolved_by uuid references users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Notifications Table
create table notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) not null,
  type text not null,
  title text not null,
  message text not null,
  is_read boolean default false,
  metadata jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS Policies (Basic examples, need refinement based on auth)
alter table users enable row level security;
alter table verifications enable row level security;
alter table trips enable row level security;
alter table delivery_requests enable row level security;
alter table matches enable row level security;
alter table payments enable row level security;
alter table wallets enable row level security;
alter table withdrawals enable row level security;
alter table ratings enable row level security;
alter table disputes enable row level security;
alter table notifications enable row level security;

-- Policy: Users can view their own data
create policy "Users can view own data" on users for select using (auth.uid() = id);
create policy "Users can update own data" on users for update using (auth.uid() = id);

-- Function to handle new user signup trigger
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  
  insert into public.wallets (user_id)
  values (new.id);
  
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for auth.users
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
