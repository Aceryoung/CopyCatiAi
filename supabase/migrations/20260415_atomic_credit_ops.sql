-- ============================================================
-- Migration: Atomic Credit Operations
-- 이슈 1: Race Condition 방어 - 원자적 크레딧 차감
-- 이슈 2: 에러 환불(Rollback) - 크레딧 복구
--
-- ※ 파라미터 이름 p_user_id, p_deduct_amount 는 route.ts 호출과 일치해야 합니다.
-- ============================================================

-- 1. [광클 방어용] 원자적 크레딧 차감 함수 (RPC)
--    route.ts 호출: supabase.rpc('deduct_credit_atomic', { p_user_id: userId })
CREATE OR REPLACE FUNCTION deduct_credit_atomic(
  p_user_id UUID,
  p_deduct_amount INT DEFAULT 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_credits INT;
BEGIN
  -- FOR UPDATE: 해당 행에 Row-Lock을 걸어 동시 요청이 같은 행을 건드리지 못하게 함
  SELECT credits INTO current_credits
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  -- 크레딧이 충분한지 확인 후 차감
  IF current_credits >= p_deduct_amount THEN
    UPDATE profiles
    SET credits = credits - p_deduct_amount
    WHERE id = p_user_id;
    RETURN TRUE;  -- 차감 성공
  ELSE
    RETURN FALSE; -- 잔액 부족 (0 이하로 떨어지는 것 방어)
  END IF;
END;
$$;

-- 2. [에러 복구용] 크레딧 환불 함수 (RPC)
--    route.ts 호출: supabase.rpc('refund_credit', { p_user_id: userId })
CREATE OR REPLACE FUNCTION refund_credit(
  p_user_id UUID,
  p_refund_amount INT DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 실패 시 즉시 크레딧을 원래대로 돌려놓음
  UPDATE profiles
  SET credits = credits + p_refund_amount
  WHERE id = p_user_id;
END;
$$;
