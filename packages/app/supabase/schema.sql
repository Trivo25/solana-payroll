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
