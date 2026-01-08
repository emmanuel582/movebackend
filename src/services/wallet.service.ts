import { supabase } from '../config/supabase';

export const WalletService = {
    async getBalance(userId: string) {
        const { data, error } = await supabase
            .from('wallets')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error) throw error;
        return data;
    },

    async creditWallet(userId: string, amount: number) {
        const { data: wallet } = await supabase
            .from('wallets')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (!wallet) throw new Error('Wallet not found');

        const newBalance = Number(wallet.balance) + Number(amount);
        const newTotalEarned = Number(wallet.total_earned) + Number(amount);

        const { error } = await supabase
            .from('wallets')
            .update({
                balance: newBalance,
                total_earned: newTotalEarned,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);

        if (error) throw error;
    },

    async requestWithdrawal(userId: string, amount: number, bankDetails: { bank_name: string, account_number: string }) {
        const wallet = await this.getBalance(userId);

        if (Number(wallet.balance) < amount) {
            throw new Error('Insufficient balance');
        }

        // Deduct from wallet immediately (or hold?) - Deducting is safer to prevent double spend
        const newBalance = Number(wallet.balance) - amount;

        await supabase
            .from('wallets')
            .update({ balance: newBalance })
            .eq('user_id', userId);

        // Create Withdrawal Record
        const { data, error } = await supabase
            .from('withdrawals')
            .insert({
                user_id: userId,
                amount,
                bank_name: bankDetails.bank_name,
                account_number: bankDetails.account_number,
                status: 'pending'
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }
};
