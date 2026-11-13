create function public.record_razorpay_test_payment(
  p_payer uuid, p_payment text, p_description text, p_amount integer, p_captured_at timestamptz
) returns void language sql security definer set search_path = '' as $$
  insert into private.payment_records (payer_id, provider_payment_id, description, amount_paise, captured_at)
  values (p_payer, p_payment, 'Test payment — ' || p_description, p_amount, p_captured_at)
  on conflict (provider_payment_id) do nothing;
$$;
revoke all on function public.record_razorpay_test_payment(uuid,text,text,integer,timestamptz)
  from public, anon, authenticated;
grant execute on function public.record_razorpay_test_payment(uuid,text,text,integer,timestamptz) to service_role;
