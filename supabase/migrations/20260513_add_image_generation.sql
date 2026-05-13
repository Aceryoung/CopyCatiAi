-- ============================================================
-- Migration: Add Image Generation Support
-- 1. `generations` 테이블에 `source_type` 및 `source_summary` 컬럼 추가
-- 2. `save_generation_and_deduct` RPC 수정 (이미지 2크레딧, URL 1크레딧 처리)
-- ============================================================

-- 1. generations 테이블 스키마 확장
ALTER TABLE generations 
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'url',
ADD COLUMN IF NOT EXISTS source_summary TEXT DEFAULT NULL;

-- 2. save_generation_and_deduct RPC 업데이트
CREATE OR REPLACE FUNCTION save_generation_and_deduct(
  p_user_id UUID,
  p_source_url TEXT DEFAULT NULL,
  p_content_json JSONB DEFAULT '{}',
  p_source_type TEXT DEFAULT 'url',
  p_source_summary TEXT DEFAULT NULL,
  p_deduct_amount INT DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_credits INT;
  new_gen_id UUID;
BEGIN
  -- 1) 현재 크레딧 확인 및 차감 (Row-Level Lock)
  SELECT credits INTO current_credits
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF current_credits < p_deduct_amount THEN
    -- 크레딧 부족 시 예외 발생 (프론트에서 캐치 가능)
    RAISE EXCEPTION 'Not enough credits. Required: %, Available: %', p_deduct_amount, current_credits;
  END IF;

  -- 2) 크레딧 차감
  UPDATE profiles
  SET credits = credits - p_deduct_amount
  WHERE id = p_user_id;

  -- 3) generations 테이블에 생성 내역 INSERT
  INSERT INTO generations (
    user_id, 
    source_url, 
    source_type, 
    source_summary, 
    content_json
  )
  VALUES (
    p_user_id, 
    p_source_url, 
    p_source_type, 
    p_source_summary, 
    p_content_json
  )
  RETURNING id INTO new_gen_id;

  -- 4) 결과 반환 (옵션)
  RETURN jsonb_build_object(
    'success', true,
    'generation_id', new_gen_id,
    'deducted', p_deduct_amount,
    'remaining_credits', current_credits - p_deduct_amount
  );
END;
$$;
