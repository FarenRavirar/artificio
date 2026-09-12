// Fonte única em `@artificio/catalog-table` (spec 102 T4.2): a regra de exibição
// de faixa etária é consumida pelo SSR e pelo cliente pela MESMA função.
export {
  RESTRICTED_AGE_RATINGS,
  isRestrictedAgeRating,
  ageRatingLabel,
  normalizeAgeRating,
} from '@artificio/catalog-table';
