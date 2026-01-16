import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let supabase: SupabaseClient | null = null

export type AccountType = 'employer' | 'employee'

export interface UserAccount {
  id: string
  wallet_address: string
  name: string
  account_type: AccountType
  created_at: string
  updated_at: string
}

export function useSupabase() {
  const config = useRuntimeConfig()

  if (!supabase) {
    supabase = createClient(
      config.public.supabaseUrl,
      config.public.supabaseAnonKey
    )
  }

  // get user account by wallet address
  async function getAccount(walletAddress: string): Promise<UserAccount | null> {
    const { data, error } = await supabase!
      .from('accounts')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // no rows returned - user doesn't exist
        return null
      }
      console.error('failed to fetch account:', error)
      return null
    }

    return data as UserAccount
  }

  // create a new user account
  async function createAccount(
    walletAddress: string,
    name: string,
    accountType: AccountType
  ): Promise<UserAccount | null> {
    const { data, error } = await supabase!
      .from('accounts')
      .insert({
        wallet_address: walletAddress,
        name,
        account_type: accountType,
      })
      .select()
      .single()

    if (error) {
      console.error('failed to create account:', error)
      return null
    }

    return data as UserAccount
  }

  // update user account
  async function updateAccount(
    walletAddress: string,
    updates: Partial<Pick<UserAccount, 'name' | 'account_type'>>
  ): Promise<UserAccount | null> {
    const { data, error } = await supabase!
      .from('accounts')
      .update(updates)
      .eq('wallet_address', walletAddress)
      .select()
      .single()

    if (error) {
      console.error('failed to update account:', error)
      return null
    }

    return data as UserAccount
  }

  return {
    supabase,
    getAccount,
    createAccount,
    updateAccount,
  }
}
