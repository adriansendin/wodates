-- Verificar metadatos de usuarios en auth.users
-- Este script ayuda a diagnosticar por qué aparece "Usuario" en lugar del nombre real

-- 1. Ver todos los usuarios en auth.users y sus metadatos
SELECT 
  id,
  email,
  raw_user_meta_data,
  raw_user_meta_data->>'display_name' as display_name,
  created_at
FROM auth.users
ORDER BY created_at DESC;

-- 2. Ver usuarios que NO tienen display_name
SELECT 
  id,
  email,
  raw_user_meta_data,
  created_at
FROM auth.users
WHERE raw_user_meta_data->>'display_name' IS NULL
   OR raw_user_meta_data->>'display_name' = '';

-- 3. Ver usuarios en public.users pero verificar si existen en auth.users
SELECT 
  u.id,
  u.gender,
  u.birthDate,
  u.bio,
  au.email,
  au.raw_user_meta_data->>'display_name' as display_name,
  CASE 
    WHEN au.id IS NULL THEN '❌ No existe en auth.users'
    WHEN au.raw_user_meta_data->>'display_name' IS NULL THEN '⚠️ Sin display_name'
    ELSE '✅ OK'
  END as status
FROM public.users u
LEFT JOIN auth.users au ON au.id = u.id
ORDER BY u.id;

-- 4. Contar usuarios por estado
SELECT 
  CASE 
    WHEN au.id IS NULL THEN 'Huérfano (no existe en auth.users)'
    WHEN au.raw_user_meta_data->>'display_name' IS NULL OR au.raw_user_meta_data->>'display_name' = '' THEN 'Sin display_name'
    ELSE 'Con display_name'
  END as status,
  COUNT(*) as cantidad
FROM public.users u
LEFT JOIN auth.users au ON au.id = u.id
GROUP BY 
  CASE 
    WHEN au.id IS NULL THEN 'Huérfano (no existe en auth.users)'
    WHEN au.raw_user_meta_data->>'display_name' IS NULL OR au.raw_user_meta_data->>'display_name' = '' THEN 'Sin display_name'
    ELSE 'Con display_name'
  END;

