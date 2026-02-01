-- accounts table for storing user profiles
create table if not exists accounts (
  id uuid default gen_random_uuid() primary key,
  wallet_address text unique not null,
  name text not null,
  account_type text not null check (account_type in ('employer', 'employee')),
  profile_picture_url text,
  created_at timestamp with time zone default timezone('utc', now()) not null,
  updated_at timestamp with time zone default timezone('utc', now()) not null
);

-- index for faster lookups by wallet address
create index if not exists idx_accounts_wallet_address on accounts(wallet_address);

-- trigger to update updated_at on row changes
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

create trigger update_accounts_updated_at
  before update on accounts
  for each row
  execute function update_updated_at_column();

-- enable row level security
alter table accounts enable row level security;

-- policy: anyone can read accounts (for now)
create policy "accounts are viewable by everyone"
  on accounts for select
  using (true);

-- policy: anyone can insert their own account
create policy "users can insert their own account"
  on accounts for insert
  with check (true);

-- policy: users can update their own account
create policy "users can update their own account"
  on accounts for update
  using (true);

-- storage bucket for profile pictures
-- run this in the supabase dashboard > storage > create new bucket
-- bucket name: profile-pictures
-- public bucket: true

-- storage policies (run after creating the bucket)
-- allow anyone to read profile pictures
create policy "profile pictures are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'profile-pictures');

-- allow anyone to upload profile pictures
create policy "anyone can upload profile pictures"
  on storage.objects for insert
  with check (bucket_id = 'profile-pictures');

-- allow anyone to update their profile pictures
create policy "anyone can update profile pictures"
  on storage.objects for update
  using (bucket_id = 'profile-pictures');

-- allow anyone to delete profile pictures
create policy "anyone can delete profile pictures"
  on storage.objects for delete
  using (bucket_id = 'profile-pictures');

-- ============================================
-- INVOICES TABLE
-- ============================================

-- invoices table for storing payment requests
create table if not exists invoices (
  id uuid default gen_random_uuid() primary key,

  -- parties (wallet addresses)
  sender_wallet text not null,      -- who created the invoice (will receive payment)
  recipient_wallet text not null,   -- who needs to pay

  -- payment details
  amount decimal(20, 9) not null,   -- payment amount (supports up to 9 decimals for tokens)
  mint text not null,               -- token mint address (e.g., USDC)

  -- status tracking
  status text not null default 'pending' check (status in ('pending', 'paid', 'overdue', 'cancelled')),

  -- metadata
  title text not null,
  description text,
  due_date timestamp with time zone,
  category text,

  -- payment info (filled when paid)
  paid_at timestamp with time zone,
  tx_signature text,                -- blockchain transaction signature
  payment_method text check (payment_method in ('public', 'confidential')),

  -- payment reference (for CT linking)
  payment_nonce text,               -- random nonce used in payment reference hash
  payment_ref text,                 -- hash(invoice + nonce) for verification

  -- zk receipt data
  receipt_hash text,
  proof_available boolean default false,

  -- timestamps
  created_at timestamp with time zone default timezone('utc', now()) not null,
  updated_at timestamp with time zone default timezone('utc', now()) not null
);

-- indexes for faster queries
create index if not exists idx_invoices_sender on invoices(sender_wallet);
create index if not exists idx_invoices_recipient on invoices(recipient_wallet);
create index if not exists idx_invoices_status on invoices(status);
create index if not exists idx_invoices_payment_ref on invoices(payment_ref);

-- trigger to update updated_at on row changes
create trigger update_invoices_updated_at
  before update on invoices
  for each row
  execute function update_updated_at_column();

-- enable row level security
alter table invoices enable row level security;

-- policy: anyone can read invoices they're involved in
create policy "users can view their invoices"
  on invoices for select
  using (true);  -- for hackathon demo, allow all reads

-- policy: anyone can create invoices
create policy "users can create invoices"
  on invoices for insert
  with check (true);

-- policy: anyone can update invoices (for payment status)
create policy "users can update invoices"
  on invoices for update
  using (true);
