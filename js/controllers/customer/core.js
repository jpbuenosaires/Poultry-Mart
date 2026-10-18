// customer/core.js — customer portal: state, API client, and product image assets
/**
 * customer.js — Customer Portal Controller
 * ─────────────────────────────────────────────────────────────────────────────
 * Improvements in this version:
 *  • Direct quantity text-input in cart & product detail
 *  • Real-time promo code validation (validate_promo endpoint)
 *  • Remove applied promo code
 *  • Delivery date restricted to operational_hours days only
 *  • Time slots: past slots hidden for same-day delivery
 *  • Out-of-stock warnings (product_batches.remaining_qty)
 *  • Order tracking timeline (step-by-step visual)
 *  • Dispatch / delivery timestamps on order detail
 *  • Proof of Delivery display
 *  • Cancellation reason dropdown
 *  • Payment verification status (GCash)
 *  • Leave a Review button on completed orders
 *  • File a Dispute button on completed orders
 *  • Dispute status tracking
 *  • Change Password in profile
 *  • Default address tagged in checkout dropdown
 *  • Low-stock warnings on catalog cards
 *  • Wholesale tier banner on product cards
 *
 * Depends on (loaded before this file):
 *   shared/constants.js · shared/utils.js · shared/uiHelpers.js · shared/apiService.js
 */

'use strict';

/* ════════════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════════════*/

const state = {
  user:           null,
  cart:           [],
  products:       [],       // full product list with stock & wholesale data
  categories:     [],
  currentProduct: null,
  pageHistory:    ['home'],
  detailQty:      1,
  checkoutPromo:  null,     // { promo_id, code, discount_type, discount_value, discount_amount }
  checkoutMeta:   null,     // { zones, slots, hours }
  savedAddresses: [],
  notifications:  [],
notifFilter:    '',       // active notification type filter ('' = all)
serverTime:     null,     // { date, time, dow } from Asia/Manila server clock
  allOrders:      null,     // raw order list cache for client-side filtering
  stockMap:       {},       // product_id → remaining_qty  (refreshed on cart/catalog load)
};

/* ════════════════════════════════════════════════════════════
   API SERVICE
═══════════════════════════════════════════════════════════════*/

const CUSTOMER_API = 'api/customer_api.php';
const { apiFetch, apiUrl } = createSimpleApiFetch(CUSTOMER_API);

/* ════════════════════════════════════════════════════════════
   PRODUCT IMAGE ASSETS
   Keyed by lowercase product name → relative paths under
   components/PoultryMart-Assets/.
   Lookup is attempted (a) exact, then (b) partial substring.
═══════════════════════════════════════════════════════════════*/
const PRODUCT_IMG_BASE = 'components/PoultryMart-Assets/';

const PRODUCT_IMAGES = Object.freeze({
  // ── 01 Whole Birds ──────────────────────────────────────────
  'whole chicken (fresh)':                ['01-WholeBirds/WholeChicken(Fresh)/Whole fresh chicken.JPG',  '01-WholeBirds/WholeChicken(Fresh)/Whole fresh chicken1.JPG', '01-WholeBirds/WholeChicken(Fresh)/Whole fresh chicken2.JPG'],
  'whole chicken (frozen)':               ['01-WholeBirds/WholeChicken(Frozen)/frozen.jpg',              '01-WholeBirds/WholeChicken(Frozen)/fozen2.jpg',              '01-WholeBirds/WholeChicken(Frozen)/frozen1.jpg'],
  'whole duck':                           ['01-WholeBirds/WholeDuck/duck.jpg',                           '01-WholeBirds/WholeDuck/duck1.jpg',                          '01-WholeBirds/WholeDuck/duck2.jpg'],
  'whole native chicken':                 ['01-WholeBirds/WholeNativeChicken/Whole Native Chicken.JPG',  '01-WholeBirds/WholeNativeChicken/Whole Native Chicken1.JPG', '01-WholeBirds/WholeNativeChicken/Whole chicken native2.JPG'],
  'whole turkey':                         ['01-WholeBirds/WholeTurkey/Whole Turkey.JPG',                 '01-WholeBirds/WholeTurkey/Whole Turkey1.JPG',                '01-WholeBirds/WholeTurkey/Whole Turkey2.JPG'],
  // ── 02 Prime Cuts ───────────────────────────────────────────
  'bone-in chicken breast':               ['02-PrimeCuts/Bone-in chicken breast/Breast1.JPG',            '02-PrimeCuts/Bone-in chicken breast/Breast.AVIF',            '02-PrimeCuts/Bone-in chicken breast/Breast2.JPG'],
  'chicken drumettes':                    ['02-PrimeCuts/Chicken Drumettes/Drumettes1.JPG',              '02-PrimeCuts/Chicken Drumettes/Drumettes.WEBP',              '02-PrimeCuts/Chicken Drumettes/Drumettes2.JPG'],
  'chicken drumstick':                    ['02-PrimeCuts/Chicken Drumstick/Drumstick.JPG',               '02-PrimeCuts/Chicken Drumstick/Drumstick1.JPG',              '02-PrimeCuts/Chicken Drumstick/Drumstick2.JPG'],
  'chicken pecho':                        ['02-PrimeCuts/Chicken pecho (ribs&back)/Pecho.JPG',           '02-PrimeCuts/Chicken pecho (ribs&back)/Pecho1.PNG',          '02-PrimeCuts/Chicken pecho (ribs&back)/Pecho2.WEBP'],
  'chicken thighs (bone-in)':             ['02-PrimeCuts/Chicken Thighs (bone-in)/Thighs.JPG',           '02-PrimeCuts/Chicken Thighs (bone-in)/Thighs1.JPG',          '02-PrimeCuts/Chicken Thighs (bone-in)/Thighs2.JPG'],
  'chicken wingettes & flats':            ['02-PrimeCuts/Chicken wingettes & flats/Wingettes & flats.JPG','02-PrimeCuts/Chicken wingettes & flats/Wingettes & flats1.JPG','02-PrimeCuts/Chicken wingettes & flats/Wingettes & flats2.JPG'],
  'chicken wings':                        ['02-PrimeCuts/Chicken wings/Chicken wings.JPG',               '02-PrimeCuts/Chicken wings/Chicken wings1.JPG',               '02-PrimeCuts/Chicken wings/Chicken wings2.JPG'],
  'duck leg quarter (bone-in)':           ['02-PrimeCuts/Duck leg quarter (bone-in)/Duck leg.JPG',       '02-PrimeCuts/Duck leg quarter (bone-in)/Duck leg1.JPG',       '02-PrimeCuts/Duck leg quarter (bone-in)/Duck leg2.JPG'],
  'whole leg quarter':                    ['02-PrimeCuts/Whole leg quarter/Whole leg quarter.JPG',        '02-PrimeCuts/Whole leg quarter/Whole leg quarter1.JPG',       '02-PrimeCuts/Whole leg quarter/Whole leg quarter2.JPG'],
  // ── 03 Boneless & Skinless ──────────────────────────────────
  'boneless duck breast':                 ['03-Boneless&SkinlessCuts/Boneless duck breast/Boneless duck breast.JPG',             '03-Boneless&SkinlessCuts/Boneless duck breast/Boneless duck breast1.JPG',            '03-Boneless&SkinlessCuts/Boneless duck breast/Boneless duck breast2.JPG'],
  'boneless skinless chicken breast':     ['03-Boneless&SkinlessCuts/Boneless skinless chicken breast/Boneless chicken breast.JPG','03-Boneless&SkinlessCuts/Boneless skinless chicken breast/Boneless chicken breast1.JPG','03-Boneless&SkinlessCuts/Boneless skinless chicken breast/Boneless chicken breast2.JPG'],
  'boneless skinless chicken thighs':     ['03-Boneless&SkinlessCuts/Boneless skinless chicken thighs/Boneless chicken thighs.JPG','03-Boneless&SkinlessCuts/Boneless skinless chicken thighs/Boneless chicken thighs1.JPG','03-Boneless&SkinlessCuts/Boneless skinless chicken thighs/Boneless chicken thighs2.JPG'],
  'butterfly chicken breast':             ['03-Boneless&SkinlessCuts/Butterfly chicken breast/Butterfly breast.JPG',              '03-Boneless&SkinlessCuts/Butterfly chicken breast/Butterfly breast1.JPG',             '03-Boneless&SkinlessCuts/Butterfly chicken breast/Butterfly breast2.JPG'],
  'chicken tenders':                      ['03-Boneless&SkinlessCuts/Chicken tenders/Tenders.JPG',                                '03-Boneless&SkinlessCuts/Chicken tenders/Tenders1.JPG',                              '03-Boneless&SkinlessCuts/Chicken tenders/Tenders2.JPG'],
  // ── 04 Minced & Ground ──────────────────────────────────────
  'chicken burger patty':                 ['04-Minced&GroundPoultry/Chicken burger patty/Patty.JPG',     '04-Minced&GroundPoultry/Chicken burger patty/Patty1.PNG',    '04-Minced&GroundPoultry/Chicken burger patty/Patty2.JPG'],
  'ground chicken 250g':                  ['04-Minced&GroundPoultry/Ground chicken 250g/Ground chicken 250g.PNG'],
  'ground chicken 500g':                  ['04-Minced&GroundPoultry/Ground chicken 500g/Ground chicken500g.png'],
  // ── 05 Giblets & Offal ──────────────────────────────────────
  'chicken feet':                         ['05-Giblets&Offal/ChickenFeet/ChickenFeet_01.jpg',     '05-Giblets&Offal/ChickenFeet/ChickenFeet_02.jpg',     '05-Giblets&Offal/ChickenFeet/ChickenFeet_03.jpg'],
  'chicken gizzard':                      ['05-Giblets&Offal/ChickenGizzard/ChickenGizzard_01.jpg','05-Giblets&Offal/ChickenGizzard/ChickenGizzard_02.jpg','05-Giblets&Offal/ChickenGizzard/ChickenGizzard_03.jpg'],
  'chicken head':                         ['05-Giblets&Offal/ChickenHead/ChickenHead_01.jpg',      '05-Giblets&Offal/ChickenHead/ChickenHead_02.jpg',     '05-Giblets&Offal/ChickenHead/ChickenHead_03.jpg'],
  'chicken heart':                        ['05-Giblets&Offal/ChickenHeart/ChickenHeart_01.jpg',    '05-Giblets&Offal/ChickenHeart/ChickenHeart_02.jpg',   '05-Giblets&Offal/ChickenHeart/ChickenHeart_03.jpg'],
  'chicken liver':                        ['05-Giblets&Offal/ChickenLiver/ChickenLiver_01.jpg',    '05-Giblets&Offal/ChickenLiver/ChickenLiver_02.jpg',   '05-Giblets&Offal/ChickenLiver/ChickenLiver_03.jpg'],
  'chicken neck':                         ['05-Giblets&Offal/ChickenNeck/ChickenNeck_01.jpg',      '05-Giblets&Offal/ChickenNeck/ChickenNeck_02.jpg',     '05-Giblets&Offal/ChickenNeck/ChickenNeck_03.jpg'],
  'mixed giblets':                        ['05-Giblets&Offal/MixedGiblets/MixedGibletsPack_1.jpg', '05-Giblets&Offal/MixedGiblets/MixedGibletsPack_2.jpg'],
  // ── 06 Ready-to-Cook & Processed ────────────────────────────
  'breaded chicken nuggets':              ['06-Ready-to-Cook&Processed/BreadedChickenNuggets/BreadedChickenNuggets_1.jpg',    '06-Ready-to-Cook&Processed/BreadedChickenNuggets/BreadedChickenNuggets_2.jpg',    '06-Ready-to-Cook&Processed/BreadedChickenNuggets/BreadedChickenNuggets_3.jpg'],
  'breaded chicken patty':                ['06-Ready-to-Cook&Processed/BreadedChickenPatty/BreadedChickenPatty_1.jpg',        '06-Ready-to-Cook&Processed/BreadedChickenPatty/BreadedChickenPatty_2.jpg',        '06-Ready-to-Cook&Processed/BreadedChickenPatty/BreadedChickenPatty_3.jpg'],
  'chicken giniling ready pack':          ['06-Ready-to-Cook&Processed/ChickenGinilingReadyPack/ChickenGinilingReadyPack_1.jpg','06-Ready-to-Cook&Processed/ChickenGinilingReadyPack/ChickenGinilingReadyPack_2.jpg','06-Ready-to-Cook&Processed/ChickenGinilingReadyPack/ChickenGinilingReadyPack_3.jpg'],
  'chicken longganisa':                   ['06-Ready-to-Cook&Processed/ChickenLongganisa/ChickenLongganisa_1.jpg',            '06-Ready-to-Cook&Processed/ChickenLongganisa/ChickenLongganisa_2.jpg',            '06-Ready-to-Cook&Processed/ChickenLongganisa/ChickenLongganisa_3.jpg'],
  'chicken skewers':                      ['06-Ready-to-Cook&Processed/ChickenSkewers-Isaw/ChickenSkewers_1.jpg',             '06-Ready-to-Cook&Processed/ChickenSkewers-Isaw/ChickenSkewers_2.jpg',             '06-Ready-to-Cook&Processed/ChickenSkewers-Isaw/ChickenSkewers_3.png'],
  'chicken isaw':                         ['06-Ready-to-Cook&Processed/ChickenSkewers-Isaw/ChickenSkewers_1.jpg',             '06-Ready-to-Cook&Processed/ChickenSkewers-Isaw/ChickenSkewers_2.jpg',             '06-Ready-to-Cook&Processed/ChickenSkewers-Isaw/ChickenSkewers_3.png'],
  'chicken tocino':                       ['06-Ready-to-Cook&Processed/ChickenTocino/ChickenTocino_1.jpg',                    '06-Ready-to-Cook&Processed/ChickenTocino/ChickenTocino_2.jpg',                    '06-Ready-to-Cook&Processed/ChickenTocino/ChickenTocino_3.jpg'],
  'marinated chicken bbq':                ['06-Ready-to-Cook&Processed/MarinatedChickenBBQ/MarinatedChickenBBQ_1.jpg',        '06-Ready-to-Cook&Processed/MarinatedChickenBBQ/MarinatedChickenBBQ_2.jpg',        '06-Ready-to-Cook&Processed/MarinatedChickenBBQ/MarinatedChickenBBQ_3.jpg'],
  'marinated chicken inasal':             ['06-Ready-to-Cook&Processed/MarinatedChickenInasal/MarinatedChickenInasal_1.jpg',  '06-Ready-to-Cook&Processed/MarinatedChickenInasal/MarinatedChickenInasal_2.jpg',  '06-Ready-to-Cook&Processed/MarinatedChickenInasal/MarinatedChickenInasal_3.jpg'],
  // ── 07 Specialty Poultry ────────────────────────────────────
  'whole guinea fowl':                    ['07-SpecialtyPoultry/WholeGuineaFowl/WholeGuineaFowl_1.jpg','07-SpecialtyPoultry/WholeGuineaFowl/WholeGuineaFowl_2.jpg','07-SpecialtyPoultry/WholeGuineaFowl/WholeGuineaFowl_3.jpg'],
  'whole pheasant':                       ['07-SpecialtyPoultry/WholePheasant/WholePheasant_1.jpg',   '07-SpecialtyPoultry/WholePheasant/WholePheasant_2.jpg',   '07-SpecialtyPoultry/WholePheasant/WholePheasant_3.jpg'],
  'whole quail':                          ['07-SpecialtyPoultry/WholeQuail/WholeQuail_1.jpg',         '07-SpecialtyPoultry/WholeQuail/WholeQuail_2.jpg',         '07-SpecialtyPoultry/WholeQuail/WholeQuail_3.jpg'],
  'whole squab':                          ['07-SpecialtyPoultry/WholeSquab/WholeSquab_1.jpg',         '07-SpecialtyPoultry/WholeSquab/WholeSquab_2.jpg',         '07-SpecialtyPoultry/WholeSquab/WholeSquab_3.jpg'],
  // ── 08 Eggs ─────────────────────────────────────────────────
  'balut':                                ['08-Eggs/Balut/BalutEgg_1.jpg',                       '08-Eggs/Balut/BalutEgg_2.jpg'],
  'brown chicken eggs':                   ['08-Eggs/BrownChickenEggs/BrownChickenEggs_1.jpg',    '08-Eggs/BrownChickenEggs/BrownChickenEggs_2.jpg',   '08-Eggs/BrownChickenEggs/BrownChickenEggs_3.jpg'],
  'duck eggs':                            ['08-Eggs/DuckEggs/DuckEggs_1.jpg',                    '08-Eggs/DuckEggs/DuckEggs_2.jpg',                   '08-Eggs/DuckEggs/DuckEggs_3.jpg'],
  'native chicken eggs':                  ['08-Eggs/NativeChickenEggs/NativeChickenEggs_1.jpg',  '08-Eggs/NativeChickenEggs/NativeChickenEggs_2.jpg'],
  'quail eggs':                           ['08-Eggs/QuailEggs/QuailEggs_1.jpg',                  '08-Eggs/QuailEggs/QuailEggs_2.jpg',                 '08-Eggs/QuailEggs/QuailEggs_3.jpg'],
  'salted eggs':                          ['08-Eggs/SaltedEggs/SaltedEgg_1.jpg',                 '08-Eggs/SaltedEggs/SaltedEgg_2.jpg',                '08-Eggs/SaltedEggs/SaltedEgg_3.jpg'],
  'white chicken eggs':                   ['08-Eggs/WhiteChickenEggs/WhiteChickenEggs_1.jpg',    '08-Eggs/WhiteChickenEggs/WhiteChickenEggs_2.jpg',   '08-Eggs/WhiteChickenEggs/WhiteChickenEggs_3.jpg'],
});

/**
 * Resolve image URLs for a product.
 * Tries (a) exact lowercase name match, (b) partial substring match.
 * Returns an array of full relative URLs, or [] if no match.
 *
 * @param {{ name: string }} p
 * @returns {string[]}
 */
function getProductImgs(p) {
  const key = (p.name || '').toLowerCase().trim();
  // (a) exact
  if (PRODUCT_IMAGES[key]) {
    return PRODUCT_IMAGES[key].map(f => PRODUCT_IMG_BASE + f);
  }
  // (b) partial — map key is substring of product name or vice versa
  const match = Object.keys(PRODUCT_IMAGES).find(k =>
    key.includes(k) || k.includes(key)
  );
  if (match) {
    return PRODUCT_IMAGES[match].map(f => PRODUCT_IMG_BASE + f);
  }
  return [];
}

