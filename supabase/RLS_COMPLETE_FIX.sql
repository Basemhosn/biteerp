-- ============================================================
-- BiteERP — COMPLETE RLS FIX FOR ALL TABLES
-- This fixes every table that was broken by FOR ALL USING()
-- Run in Supabase SQL Editor — safe to run multiple times
-- ============================================================

-- Step 1: Drop ALL policies on ALL affected tables at once
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- Step 2: Recreate ALL policies correctly with WITH CHECK on INSERT

-- accounting_periods
CREATE POLICY "acc_s" ON public.accounting_periods FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "acc_i" ON public.accounting_periods FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "acc_u" ON public.accounting_periods FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "acc_d" ON public.accounting_periods FOR DELETE USING (restaurant_id = my_restaurant_id());

-- accounts
CREATE POLICY "acc_s" ON public.accounts FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "acc_i" ON public.accounts FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "acc_u" ON public.accounts FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "acc_d" ON public.accounts FOR DELETE USING (restaurant_id = my_restaurant_id());

-- audit_log
CREATE POLICY "aud_s" ON public.audit_log FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "aud_i" ON public.audit_log FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "aud_u" ON public.audit_log FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "aud_d" ON public.audit_log FOR DELETE USING (restaurant_id = my_restaurant_id());

-- branch_transfer_lines
CREATE POLICY "bra_s" ON public.branch_transfer_lines FOR SELECT USING (transfer_id IN (SELECT id FROM public.branch_transfers WHERE restaurant_id = my_restaurant_id()));
CREATE POLICY "bra_i" ON public.branch_transfer_lines FOR INSERT WITH CHECK (transfer_id IN (SELECT id FROM public.branch_transfers WHERE restaurant_id = my_restaurant_id()));
CREATE POLICY "bra_u" ON public.branch_transfer_lines FOR UPDATE USING (transfer_id IN (SELECT id FROM public.branch_transfers WHERE restaurant_id = my_restaurant_id())) WITH CHECK (transfer_id IN (SELECT id FROM public.branch_transfers WHERE restaurant_id = my_restaurant_id()));
CREATE POLICY "bra_d" ON public.branch_transfer_lines FOR DELETE USING (transfer_id IN (SELECT id FROM public.branch_transfers WHERE restaurant_id = my_restaurant_id()));

-- branch_transfers
CREATE POLICY "bra_s" ON public.branch_transfers FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "bra_i" ON public.branch_transfers FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "bra_u" ON public.branch_transfers FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "bra_d" ON public.branch_transfers FOR DELETE USING (restaurant_id = my_restaurant_id());

-- branches
CREATE POLICY "bra_s" ON public.branches FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "bra_i" ON public.branches FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "bra_u" ON public.branches FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "bra_d" ON public.branches FOR DELETE USING (restaurant_id = my_restaurant_id());

-- calculator_state
CREATE POLICY "cal_s" ON public.calculator_state FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "cal_i" ON public.calculator_state FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "cal_u" ON public.calculator_state FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "cal_d" ON public.calculator_state FOR DELETE USING (restaurant_id = my_restaurant_id());

-- cash_movements
CREATE POLICY "cas_s" ON public.cash_movements FOR SELECT USING (session_id IN (SELECT id FROM public.cash_sessions WHERE restaurant_id = my_restaurant_id()));
CREATE POLICY "cas_i" ON public.cash_movements FOR INSERT WITH CHECK (session_id IN (SELECT id FROM public.cash_sessions WHERE restaurant_id = my_restaurant_id()));
CREATE POLICY "cas_u" ON public.cash_movements FOR UPDATE USING (session_id IN (SELECT id FROM public.cash_sessions WHERE restaurant_id = my_restaurant_id())) WITH CHECK (session_id IN (SELECT id FROM public.cash_sessions WHERE restaurant_id = my_restaurant_id()));
CREATE POLICY "cas_d" ON public.cash_movements FOR DELETE USING (session_id IN (SELECT id FROM public.cash_sessions WHERE restaurant_id = my_restaurant_id()));

-- cash_sessions
CREATE POLICY "cas_s" ON public.cash_sessions FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "cas_i" ON public.cash_sessions FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "cas_u" ON public.cash_sessions FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "cas_d" ON public.cash_sessions FOR DELETE USING (restaurant_id = my_restaurant_id());

-- cashier_shifts
CREATE POLICY "cas_s" ON public.cashier_shifts FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "cas_i" ON public.cashier_shifts FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "cas_u" ON public.cashier_shifts FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "cas_d" ON public.cashier_shifts FOR DELETE USING (restaurant_id = my_restaurant_id());

-- chatter_messages
CREATE POLICY "cha_s" ON public.chatter_messages FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "cha_i" ON public.chatter_messages FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "cha_u" ON public.chatter_messages FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "cha_d" ON public.chatter_messages FOR DELETE USING (restaurant_id = my_restaurant_id());

-- chatter_reads
CREATE POLICY "cha_s" ON public.chatter_reads FOR SELECT USING (profile_id = auth.uid());
CREATE POLICY "cha_i" ON public.chatter_reads FOR INSERT WITH CHECK (profile_id = auth.uid());
CREATE POLICY "cha_u" ON public.chatter_reads FOR UPDATE USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());
CREATE POLICY "cha_d" ON public.chatter_reads FOR DELETE USING (profile_id = auth.uid());

-- company_groups
CREATE POLICY "com_s" ON public.company_groups FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "com_i" ON public.company_groups FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "com_u" ON public.company_groups FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "com_d" ON public.company_groups FOR DELETE USING (owner_id = auth.uid());

-- contacts
CREATE POLICY "con_s" ON public.contacts FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "con_i" ON public.contacts FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "con_u" ON public.contacts FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "con_d" ON public.contacts FOR DELETE USING (restaurant_id = my_restaurant_id());

-- customers
CREATE POLICY "cus_s" ON public.customers FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "cus_i" ON public.customers FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "cus_u" ON public.customers FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "cus_d" ON public.customers FOR DELETE USING (restaurant_id = my_restaurant_id());

-- daily_sales
CREATE POLICY "dai_s" ON public.daily_sales FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "dai_i" ON public.daily_sales FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "dai_u" ON public.daily_sales FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "dai_d" ON public.daily_sales FOR DELETE USING (restaurant_id = my_restaurant_id());

-- expenses
CREATE POLICY "exp_s" ON public.expenses FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "exp_i" ON public.expenses FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "exp_u" ON public.expenses FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "exp_d" ON public.expenses FOR DELETE USING (restaurant_id = my_restaurant_id());

-- ingredients
CREATE POLICY "ing_s" ON public.ingredients FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "ing_i" ON public.ingredients FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "ing_u" ON public.ingredients FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "ing_d" ON public.ingredients FOR DELETE USING (restaurant_id = my_restaurant_id());

-- inventory_log
CREATE POLICY "inv_s" ON public.inventory_log FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "inv_i" ON public.inventory_log FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "inv_u" ON public.inventory_log FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "inv_d" ON public.inventory_log FOR DELETE USING (restaurant_id = my_restaurant_id());

-- invoice_lines
CREATE POLICY "inv_s" ON public.invoice_lines FOR SELECT USING (invoice_id IN (SELECT id FROM public.invoices WHERE restaurant_id = my_restaurant_id()));
CREATE POLICY "inv_i" ON public.invoice_lines FOR INSERT WITH CHECK (invoice_id IN (SELECT id FROM public.invoices WHERE restaurant_id = my_restaurant_id()));
CREATE POLICY "inv_u" ON public.invoice_lines FOR UPDATE USING (invoice_id IN (SELECT id FROM public.invoices WHERE restaurant_id = my_restaurant_id())) WITH CHECK (invoice_id IN (SELECT id FROM public.invoices WHERE restaurant_id = my_restaurant_id()));
CREATE POLICY "inv_d" ON public.invoice_lines FOR DELETE USING (invoice_id IN (SELECT id FROM public.invoices WHERE restaurant_id = my_restaurant_id()));

-- invoices
CREATE POLICY "inv_s" ON public.invoices FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "inv_i" ON public.invoices FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "inv_u" ON public.invoices FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "inv_d" ON public.invoices FOR DELETE USING (restaurant_id = my_restaurant_id());

-- item_variants
CREATE POLICY "ite_s" ON public.item_variants FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "ite_i" ON public.item_variants FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "ite_u" ON public.item_variants FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "ite_d" ON public.item_variants FOR DELETE USING (restaurant_id = my_restaurant_id());

-- journal_entries
CREATE POLICY "jou_s" ON public.journal_entries FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "jou_i" ON public.journal_entries FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "jou_u" ON public.journal_entries FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "jou_d" ON public.journal_entries FOR DELETE USING (restaurant_id = my_restaurant_id());

-- journal_lines
CREATE POLICY "jou_s" ON public.journal_lines FOR SELECT USING (entry_id IN (SELECT id FROM public.journal_entries WHERE restaurant_id = my_restaurant_id()));
CREATE POLICY "jou_i" ON public.journal_lines FOR INSERT WITH CHECK (entry_id IN (SELECT id FROM public.journal_entries WHERE restaurant_id = my_restaurant_id()));
CREATE POLICY "jou_u" ON public.journal_lines FOR UPDATE USING (entry_id IN (SELECT id FROM public.journal_entries WHERE restaurant_id = my_restaurant_id())) WITH CHECK (entry_id IN (SELECT id FROM public.journal_entries WHERE restaurant_id = my_restaurant_id()));
CREATE POLICY "jou_d" ON public.journal_lines FOR DELETE USING (entry_id IN (SELECT id FROM public.journal_entries WHERE restaurant_id = my_restaurant_id()));

-- loyalty_settings
CREATE POLICY "loy_s" ON public.loyalty_settings FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "loy_i" ON public.loyalty_settings FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "loy_u" ON public.loyalty_settings FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "loy_d" ON public.loyalty_settings FOR DELETE USING (restaurant_id = my_restaurant_id());

-- loyalty_transactions
CREATE POLICY "loy_s" ON public.loyalty_transactions FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "loy_i" ON public.loyalty_transactions FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "loy_u" ON public.loyalty_transactions FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "loy_d" ON public.loyalty_transactions FOR DELETE USING (restaurant_id = my_restaurant_id());

-- menu_categories
CREATE POLICY "men_s" ON public.menu_categories FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "men_i" ON public.menu_categories FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "men_u" ON public.menu_categories FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "men_d" ON public.menu_categories FOR DELETE USING (restaurant_id = my_restaurant_id());

-- menu_item_recipes
CREATE POLICY "men_s" ON public.menu_item_recipes FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "men_i" ON public.menu_item_recipes FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "men_u" ON public.menu_item_recipes FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "men_d" ON public.menu_item_recipes FOR DELETE USING (restaurant_id = my_restaurant_id());

-- menu_items
CREATE POLICY "men_s" ON public.menu_items FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "men_i" ON public.menu_items FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "men_u" ON public.menu_items FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "men_d" ON public.menu_items FOR DELETE USING (restaurant_id = my_restaurant_id());

-- menu_modifier_groups
CREATE POLICY "men_s" ON public.menu_modifier_groups FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "men_i" ON public.menu_modifier_groups FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "men_u" ON public.menu_modifier_groups FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "men_d" ON public.menu_modifier_groups FOR DELETE USING (restaurant_id = my_restaurant_id());

-- menu_modifiers
CREATE POLICY "men_s" ON public.menu_modifiers FOR SELECT USING (group_id IN (SELECT id FROM public.menu_modifier_groups WHERE restaurant_id = my_restaurant_id()));
CREATE POLICY "men_i" ON public.menu_modifiers FOR INSERT WITH CHECK (group_id IN (SELECT id FROM public.menu_modifier_groups WHERE restaurant_id = my_restaurant_id()));
CREATE POLICY "men_u" ON public.menu_modifiers FOR UPDATE USING (group_id IN (SELECT id FROM public.menu_modifier_groups WHERE restaurant_id = my_restaurant_id())) WITH CHECK (group_id IN (SELECT id FROM public.menu_modifier_groups WHERE restaurant_id = my_restaurant_id()));
CREATE POLICY "men_d" ON public.menu_modifiers FOR DELETE USING (group_id IN (SELECT id FROM public.menu_modifier_groups WHERE restaurant_id = my_restaurant_id()));

-- order_items
CREATE POLICY "ord_s" ON public.order_items FOR SELECT USING (order_id IN (SELECT id FROM public.orders WHERE restaurant_id = my_restaurant_id()));
CREATE POLICY "ord_i" ON public.order_items FOR INSERT WITH CHECK (order_id IN (SELECT id FROM public.orders WHERE restaurant_id = my_restaurant_id()));
CREATE POLICY "ord_u" ON public.order_items FOR UPDATE USING (order_id IN (SELECT id FROM public.orders WHERE restaurant_id = my_restaurant_id())) WITH CHECK (order_id IN (SELECT id FROM public.orders WHERE restaurant_id = my_restaurant_id()));
CREATE POLICY "ord_d" ON public.order_items FOR DELETE USING (order_id IN (SELECT id FROM public.orders WHERE restaurant_id = my_restaurant_id()));

-- orders
CREATE POLICY "ord_s" ON public.orders FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "ord_i" ON public.orders FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "ord_u" ON public.orders FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "ord_d" ON public.orders FOR DELETE USING (restaurant_id = my_restaurant_id());

-- partner_ledger
CREATE POLICY "par_s" ON public.partner_ledger FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "par_i" ON public.partner_ledger FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "par_u" ON public.partner_ledger FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "par_d" ON public.partner_ledger FOR DELETE USING (restaurant_id = my_restaurant_id());

-- pl_history
CREATE POLICY "pl__s" ON public.pl_history FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "pl__i" ON public.pl_history FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "pl__u" ON public.pl_history FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "pl__d" ON public.pl_history FOR DELETE USING (restaurant_id = my_restaurant_id());

-- po_lines
CREATE POLICY "po__s" ON public.po_lines FOR SELECT USING (po_id IN (SELECT id FROM public.purchase_orders WHERE restaurant_id = my_restaurant_id()));
CREATE POLICY "po__i" ON public.po_lines FOR INSERT WITH CHECK (po_id IN (SELECT id FROM public.purchase_orders WHERE restaurant_id = my_restaurant_id()));
CREATE POLICY "po__u" ON public.po_lines FOR UPDATE USING (po_id IN (SELECT id FROM public.purchase_orders WHERE restaurant_id = my_restaurant_id())) WITH CHECK (po_id IN (SELECT id FROM public.purchase_orders WHERE restaurant_id = my_restaurant_id()));
CREATE POLICY "po__d" ON public.po_lines FOR DELETE USING (po_id IN (SELECT id FROM public.purchase_orders WHERE restaurant_id = my_restaurant_id()));

-- pos_permissions
CREATE POLICY "pos_s" ON public.pos_permissions FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "pos_i" ON public.pos_permissions FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "pos_u" ON public.pos_permissions FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "pos_d" ON public.pos_permissions FOR DELETE USING (restaurant_id = my_restaurant_id());

-- production_log
CREATE POLICY "pro_s" ON public.production_log FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "pro_i" ON public.production_log FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "pro_u" ON public.production_log FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "pro_d" ON public.production_log FOR DELETE USING (restaurant_id = my_restaurant_id());

-- profiles
CREATE POLICY "pro_s" ON public.profiles FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "pro_i" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "pro_u" ON public.profiles FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (id = auth.uid());
CREATE POLICY "pro_d" ON public.profiles FOR DELETE USING (restaurant_id = my_restaurant_id());

-- promotions
CREATE POLICY "pro_s" ON public.promotions FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "pro_i" ON public.promotions FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "pro_u" ON public.promotions FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "pro_d" ON public.promotions FOR DELETE USING (restaurant_id = my_restaurant_id());

-- purchase_orders
CREATE POLICY "pur_s" ON public.purchase_orders FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "pur_i" ON public.purchase_orders FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "pur_u" ON public.purchase_orders FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "pur_d" ON public.purchase_orders FOR DELETE USING (restaurant_id = my_restaurant_id());

-- receipt_lines
CREATE POLICY "rec_s" ON public.receipt_lines FOR SELECT USING (receipt_id IN (SELECT id FROM public.receipts WHERE restaurant_id = my_restaurant_id()));
CREATE POLICY "rec_i" ON public.receipt_lines FOR INSERT WITH CHECK (receipt_id IN (SELECT id FROM public.receipts WHERE restaurant_id = my_restaurant_id()));
CREATE POLICY "rec_u" ON public.receipt_lines FOR UPDATE USING (receipt_id IN (SELECT id FROM public.receipts WHERE restaurant_id = my_restaurant_id())) WITH CHECK (receipt_id IN (SELECT id FROM public.receipts WHERE restaurant_id = my_restaurant_id()));
CREATE POLICY "rec_d" ON public.receipt_lines FOR DELETE USING (receipt_id IN (SELECT id FROM public.receipts WHERE restaurant_id = my_restaurant_id()));

-- receipts
CREATE POLICY "rec_s" ON public.receipts FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "rec_i" ON public.receipts FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "rec_u" ON public.receipts FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "rec_d" ON public.receipts FOR DELETE USING (restaurant_id = my_restaurant_id());

-- recipe_lines
CREATE POLICY "rec_s" ON public.recipe_lines FOR SELECT USING (recipe_id IN (SELECT id FROM public.recipes WHERE restaurant_id = my_restaurant_id()));
CREATE POLICY "rec_i" ON public.recipe_lines FOR INSERT WITH CHECK (recipe_id IN (SELECT id FROM public.recipes WHERE restaurant_id = my_restaurant_id()));
CREATE POLICY "rec_u" ON public.recipe_lines FOR UPDATE USING (recipe_id IN (SELECT id FROM public.recipes WHERE restaurant_id = my_restaurant_id())) WITH CHECK (recipe_id IN (SELECT id FROM public.recipes WHERE restaurant_id = my_restaurant_id()));
CREATE POLICY "rec_d" ON public.recipe_lines FOR DELETE USING (recipe_id IN (SELECT id FROM public.recipes WHERE restaurant_id = my_restaurant_id()));

-- recipes
CREATE POLICY "rec_s" ON public.recipes FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "rec_i" ON public.recipes FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "rec_u" ON public.recipes FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "rec_d" ON public.recipes FOR DELETE USING (restaurant_id = my_restaurant_id());

-- refund_lines
CREATE POLICY "ref_s" ON public.refund_lines FOR SELECT USING (refund_id IN (SELECT id FROM public.refunds WHERE restaurant_id = my_restaurant_id()));
CREATE POLICY "ref_i" ON public.refund_lines FOR INSERT WITH CHECK (refund_id IN (SELECT id FROM public.refunds WHERE restaurant_id = my_restaurant_id()));
CREATE POLICY "ref_u" ON public.refund_lines FOR UPDATE USING (refund_id IN (SELECT id FROM public.refunds WHERE restaurant_id = my_restaurant_id())) WITH CHECK (refund_id IN (SELECT id FROM public.refunds WHERE restaurant_id = my_restaurant_id()));
CREATE POLICY "ref_d" ON public.refund_lines FOR DELETE USING (refund_id IN (SELECT id FROM public.refunds WHERE restaurant_id = my_restaurant_id()));

-- refunds
CREATE POLICY "ref_s" ON public.refunds FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "ref_i" ON public.refunds FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "ref_u" ON public.refunds FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "ref_d" ON public.refunds FOR DELETE USING (restaurant_id = my_restaurant_id());

-- restaurant_tables
CREATE POLICY "res_s" ON public.restaurant_tables FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "res_i" ON public.restaurant_tables FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "res_u" ON public.restaurant_tables FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "res_d" ON public.restaurant_tables FOR DELETE USING (restaurant_id = my_restaurant_id());

-- restaurants
CREATE POLICY "res_s" ON public.restaurants FOR SELECT USING (id = my_restaurant_id());
CREATE POLICY "res_i" ON public.restaurants FOR INSERT WITH CHECK (true);
CREATE POLICY "res_u" ON public.restaurants FOR UPDATE USING (id = my_restaurant_id()) WITH CHECK (true);
CREATE POLICY "res_d" ON public.restaurants FOR DELETE USING (id = my_restaurant_id());

-- staff
CREATE POLICY "sta_s" ON public.staff FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "sta_i" ON public.staff FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "sta_u" ON public.staff FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "sta_d" ON public.staff FOR DELETE USING (restaurant_id = my_restaurant_id());

-- staff_schedule
CREATE POLICY "sta_s" ON public.staff_schedule FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "sta_i" ON public.staff_schedule FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "sta_u" ON public.staff_schedule FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "sta_d" ON public.staff_schedule FOR DELETE USING (restaurant_id = my_restaurant_id());

-- stock_movements
CREATE POLICY "sto_s" ON public.stock_movements FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "sto_i" ON public.stock_movements FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "sto_u" ON public.stock_movements FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "sto_d" ON public.stock_movements FOR DELETE USING (restaurant_id = my_restaurant_id());

-- suppliers
CREATE POLICY "sup_s" ON public.suppliers FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "sup_i" ON public.suppliers FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "sup_u" ON public.suppliers FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "sup_d" ON public.suppliers FOR DELETE USING (restaurant_id = my_restaurant_id());

-- user_permissions
CREATE POLICY "use_s" ON public.user_permissions FOR SELECT USING (restaurant_id = my_restaurant_id());
CREATE POLICY "use_i" ON public.user_permissions FOR INSERT WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "use_u" ON public.user_permissions FOR UPDATE USING (restaurant_id = my_restaurant_id()) WITH CHECK (restaurant_id = my_restaurant_id());
CREATE POLICY "use_d" ON public.user_permissions FOR DELETE USING (restaurant_id = my_restaurant_id());

SELECT 'ALL RLS POLICIES FIXED SUCCESSFULLY' AS status;