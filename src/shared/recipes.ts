import type { Recipe } from './recipeTypes.js';
import { key, sec, basic, st, r } from './recipeHelpers.js';
import { EXTENDED_RECIPES } from './recipesExtended.js';

export const BASE_RECIPES: Recipe[] = [
  r('chicken-rice-zucchini', 'Курица с рисом и кабачком', { time: 40, servings: 4, kcal: 520, tags: ['ужин', 'впрок'], color: '#C9793A' }, [
    key('chicken_thigh', 800, 'g', [{ key: 'chicken_breast' }, { key: 'chicken_whole' }]),
    key('rice', 300, 'g', [{ key: 'bulgur' }]),
    sec('zucchini', 1, 'pcs', [{ key: 'eggplant', qty: 1, unit: 'pcs' }, { key: 'bell_pepper', qty: 2, unit: 'pcs' }]),
    sec('onion', 1, 'pcs', [{ key: 'green_onion', qty: 50, unit: 'g' }]),
    sec('carrot', 1, 'pcs'),
    sec('garlic', 2, 'pcs'),
    basic('vegetable_oil', 2, 'tbsp'), basic('spices'), basic('salt'),
  ], [
    st('Промойте рис до прозрачной воды. Курицу нарежьте крупными кусками, посолите и поперчите.'),
    st('Разогрейте масло в глубокой сковороде или казане. Обжарьте курицу до золотистой корочки.', 7),
    st('Добавьте нарезанные лук и морковь, жарьте до мягкости.', 5),
    st('Добавьте кабачок кубиками и чеснок, перемешайте, всыпьте рис и специи.', 2),
    st('Залейте 600 мл горячей воды, посолите. Накройте крышкой и тушите на слабом огне, пока рис не впитает воду.', 20),
    st('Выключите огонь и дайте постоять под крышкой.', 5),
  ]),

  r('kefir-pancakes', 'Оладьи на кефире', { time: 25, servings: 2, kcal: 430, tags: ['завтрак'], color: '#E0A94B' }, [
    key('kefir', 250, 'ml', [{ key: 'yogurt', qty: 250, unit: 'g' }, { key: 'milk', qty: 200, unit: 'ml' }]),
    key('flour', 200, 'g'),
    sec('egg', 1, 'pcs'),
    basic('sugar', 1, 'tbsp'), basic('baking_powder', 1, 'tsp'), basic('salt'), basic('vegetable_oil', 3, 'tbsp'),
  ], [
    st('Смешайте кефир комнатной температуры с яйцом, сахаром и солью.'),
    st('Всыпьте муку с разрыхлителем, перемешайте до густоты сметаны. Дайте тесту постоять.', 5),
    st('Разогрейте сковороду с маслом, выкладывайте тесто ложкой.'),
    st('Жарьте на среднем огне до пузырьков сверху, переверните и дожарьте.', 3),
    st('Подавайте со сметаной, мёдом или вареньем.'),
  ]),

  r('zucchini-omelet', 'Омлет с кабачком и сыром', { time: 15, servings: 2, kcal: 320, tags: ['завтрак', 'быстро'], color: '#F2C46B' }, [
    key('egg', 4, 'pcs'),
    sec('zucchini', 0.5, 'pcs', [{ key: 'tomato', qty: 2, unit: 'pcs' }, { key: 'bell_pepper', qty: 1, unit: 'pcs' }]),
    sec('cheese', 50, 'g', [{ key: 'mozzarella' }, { key: 'feta' }]),
    sec('milk', 50, 'ml', [{ key: 'kefir' }, { key: 'cream' }]),
    sec('butter', 10, 'g', [{ key: 'vegetable_oil', qty: 1, unit: 'tbsp' }]),
    basic('salt'), basic('black_pepper'),
  ], [
    st('Кабачок нарежьте тонкими полукольцами, сыр натрите.'),
    st('На сливочном масле обжарьте кабачок до мягкости.', 4),
    st('Взбейте яйца с молоком, солью и перцем, залейте кабачок.'),
    st('Посыпьте сыром, накройте крышкой и готовьте на слабом огне.', 5),
  ]),

  r('pasta-zucchini-sour-cream', 'Паста с кабачком и сметаной', { time: 25, servings: 2, kcal: 560, tags: ['ужин', 'быстро'], color: '#E9D9A6' }, [
    key('pasta', 200, 'g'),
    key('zucchini', 1, 'pcs', [{ key: 'broccoli', qty: 300, unit: 'g' }, { key: 'mushrooms', qty: 250, unit: 'g' }]),
    sec('sour_cream', 150, 'g', [{ key: 'cream', qty: 150, unit: 'ml' }, { key: 'cream_cheese' }, { key: 'yogurt' }]),
    sec('garlic', 2, 'pcs'),
    sec('cheese', 40, 'g'),
    basic('olive_oil', 2, 'tbsp'), basic('salt'), basic('black_pepper'),
  ], [
    st('Поставьте воду для пасты, посолите.'),
    st('Отварите пасту до состояния аль денте, как указано на пачке.', 9),
    st('Пока варится паста, обжарьте на масле кабачок кубиками с чесноком.', 6),
    st('Добавьте сметану и 3–4 ложки воды от пасты, прогрейте соус, не доводя до кипения.', 2),
    st('Смешайте пасту с соусом, посыпьте тёртым сыром и перцем.'),
  ]),

  r('buckwheat-merchant', 'Гречка по-купечески', { time: 50, servings: 4, kcal: 540, tags: ['ужин', 'впрок'], color: '#8A5A3B' }, [
    key('buckwheat', 300, 'g'),
    key('pork', 500, 'g', [{ key: 'beef' }, { key: 'chicken_thigh' }, { key: 'minced_meat' }]),
    sec('onion', 1, 'pcs'),
    sec('carrot', 1, 'pcs'),
    sec('tomato_paste', 30, 'g', [{ key: 'tomatoes_canned', qty: 200, unit: 'g' }, { key: 'ketchup', qty: 40, unit: 'g' }]),
    basic('vegetable_oil', 2, 'tbsp'), basic('bay_leaf'), basic('salt'), basic('black_pepper'),
  ], [
    st('Мясо нарежьте небольшими кусочками, лук — кубиком, морковь натрите.'),
    st('Обжарьте мясо на сильном огне до румяности.', 8),
    st('Добавьте лук и морковь, жарьте до мягкости.', 5),
    st('Вмешайте томатную пасту, затем промытую гречку.', 1),
    st('Залейте 600 мл горячей воды, посолите, добавьте лавровый лист. Томите под крышкой на слабом огне.', 25),
    st('Выключите огонь и дайте настояться под крышкой.', 10),
  ]),

  r('shakshuka', 'Шакшука', { time: 20, servings: 2, kcal: 340, tags: ['завтрак', 'ужин', 'быстро'], color: '#C1502E' }, [
    key('egg', 4, 'pcs'),
    key('tomatoes_canned', 400, 'g', [{ key: 'tomato', qty: 4, unit: 'pcs' }]),
    sec('bell_pepper', 1, 'pcs'),
    sec('onion', 1, 'pcs'),
    sec('garlic', 2, 'pcs'),
    sec('parsley', 10, 'g', [{ key: 'cilantro' }, { key: 'green_onion' }]),
    basic('olive_oil', 2, 'tbsp'), basic('paprika'), basic('spices'), basic('salt'),
  ], [
    st('Нарежьте лук, перец и чеснок.'),
    st('Обжарьте лук и перец на масле до мягкости.', 6),
    st('Добавьте чеснок, паприку и томаты, разомните. Тушите до загустения.', 7),
    st('Сделайте ложкой 4 углубления и разбейте в них яйца. Накройте крышкой.', 5),
    st('Посыпьте зеленью и подавайте прямо в сковороде с хлебом.'),
  ]),

  r('syrniki', 'Сырники', { time: 25, servings: 2, kcal: 480, tags: ['завтрак'], color: '#E8B77A' }, [
    key('cottage_cheese', 400, 'g'),
    key('egg', 1, 'pcs'),
    key('flour', 60, 'g'),
    sec('sour_cream', 100, 'g', [{ key: 'yogurt' }, { key: 'honey', qty: 40, unit: 'g' }]),
    basic('sugar', 2, 'tbsp'), basic('salt'), basic('vegetable_oil', 3, 'tbsp'),
  ], [
    st('Разомните творог вилкой, смешайте с яйцом, сахаром и щепоткой соли.'),
    st('Добавьте муку, чтобы масса перестала липнуть. Сформируйте 8 шайб и обваляйте в муке.'),
    st('Жарьте на среднем огне с одной стороны.', 4),
    st('Переверните, накройте крышкой и дожарьте.', 4),
    st('Подавайте со сметаной.'),
  ]),

  r('oatmeal-apple', 'Овсянка с яблоком', { time: 10, servings: 2, kcal: 360, tags: ['завтрак', 'быстро'], color: '#D9C39A' }, [
    key('oats', 100, 'g'),
    sec('milk', 400, 'ml'),
    sec('apple', 1, 'pcs', [{ key: 'banana', qty: 1, unit: 'pcs' }, { key: 'frozen_berries', qty: 100, unit: 'g' }]),
    sec('honey', 20, 'g'),
    sec('butter', 10, 'g'),
    basic('salt'),
  ], [
    st('Доведите молоко до кипения со щепоткой соли.'),
    st('Всыпьте хлопья и варите, помешивая.', 5),
    st('Добавьте яблоко кубиками, масло и мёд, дайте постоять под крышкой.', 2),
  ]),

  r('chickpea-tuna-salad', 'Салат с нутом и тунцом', { time: 10, servings: 2, kcal: 450, tags: ['обед', 'быстро'], color: '#B9A26A' }, [
    key('chickpeas_canned', 400, 'g', [{ key: 'beans_canned' }]),
    key('tuna_canned', 185, 'g'),
    sec('cucumber', 1, 'pcs'),
    sec('tomato', 2, 'pcs'),
    sec('onion', 0.5, 'pcs', [{ key: 'green_onion', qty: 20, unit: 'g' }]),
    sec('lemon', 0.5, 'pcs'),
    basic('olive_oil', 2, 'tbsp'), basic('salt'), basic('black_pepper'),
  ], [
    st('Слейте жидкость с нута и тунца.'),
    st('Нарежьте огурец, помидоры и лук.'),
    st('Смешайте всё, заправьте маслом и лимонным соком, посолите и поперчите.'),
  ]),

  r('baked-cod-potato', 'Треска, запечённая с картофелем', { time: 45, servings: 2, kcal: 480, tags: ['ужин', 'духовка'], color: '#D8C7A2' }, [
    key('white_fish', 500, 'g', [{ key: 'salmon' }]),
    key('potato', 600, 'g'),
    sec('sour_cream', 100, 'g', [{ key: 'cream', qty: 100, unit: 'ml' }, { key: 'mayonnaise', qty: 60, unit: 'g' }]),
    sec('onion', 1, 'pcs'),
    sec('dill', 15, 'g', [{ key: 'parsley' }]),
    basic('vegetable_oil', 2, 'tbsp'), basic('salt'), basic('black_pepper'),
  ], [
    st('Разогрейте духовку до 200 °C. Картофель нарежьте тонкими кружками, лук — полукольцами.'),
    st('Выложите картофель с луком в смазанную форму, посолите и запекайте.', 20),
    st('Сверху выложите рыбу, посолите, смажьте сметаной.'),
    st('Запекайте до готовности рыбы.', 15),
    st('Посыпьте рубленым укропом.'),
  ]),

  r('pumpkin-soup', 'Суп-пюре из тыквы', { time: 40, servings: 4, kcal: 250, tags: ['обед', 'впрок'], color: '#E58B2F' }, [
    key('pumpkin', 1000, 'g'),
    sec('potato', 2, 'pcs'),
    sec('onion', 1, 'pcs'),
    sec('carrot', 1, 'pcs'),
    sec('cream', 150, 'ml', [{ key: 'milk', qty: 200, unit: 'ml' }, { key: 'cream_cheese', qty: 100, unit: 'g' }]),
    sec('garlic', 1, 'pcs'),
    basic('vegetable_oil', 2, 'tbsp'), basic('salt'), basic('spices'),
  ], [
    st('Очистите и нарежьте тыкву, картофель, морковь и лук.'),
    st('Обжарьте лук, морковь и чеснок на масле в кастрюле.', 4),
    st('Добавьте тыкву и картофель, залейте водой, чтобы едва покрывала овощи. Варите до мягкости.', 20),
    st('Пробейте блендером, влейте сливки, посолите и прогрейте.', 2),
  ]),

  r('lavash-pizza', 'Пицца на лаваше', { time: 20, servings: 2, kcal: 560, tags: ['ужин', 'быстро'], color: '#D9793B' }, [
    key('lavash', 160, 'g'),
    key('cheese', 150, 'g', [{ key: 'mozzarella' }]),
    sec('tomatoes_canned', 150, 'g', [{ key: 'ketchup', qty: 60, unit: 'g' }, { key: 'tomato_paste', qty: 40, unit: 'g' }]),
    sec('mushrooms', 150, 'g'),
    sec('ham', 150, 'g', [{ key: 'sausages' }, { key: 'salami' }, { key: 'bacon', qty: 100, unit: 'g' }]),
    sec('tomato', 1, 'pcs'),
    basic('spices'),
  ], [
    st('Разогрейте духовку до 200 °C или сковороду с крышкой.'),
    st('Сложите лаваш в два слоя, смажьте томатами, посыпьте специями.'),
    st('Разложите нарезанные ветчину, грибы и помидор, посыпьте сыром.'),
    st('Запекайте, пока сыр не расплавится и не зарумянится.', 10),
  ]),

  r('chicken-plov', 'Плов с курицей', { time: 60, servings: 4, kcal: 610, tags: ['ужин', 'впрок'], color: '#D39B45' }, [
    key('rice', 400, 'g'),
    key('chicken_thigh', 700, 'g', [{ key: 'pork' }, { key: 'chicken_breast' }, { key: 'beef' }]),
    sec('carrot', 2, 'pcs'),
    sec('onion', 2, 'pcs'),
    sec('garlic', 6, 'pcs'),
    basic('vegetable_oil', 4, 'tbsp'), basic('spices'), basic('salt'),
  ], [
    st('Промойте рис несколько раз. Морковь нарежьте соломкой, лук — полукольцами.'),
    st('В казане раскалите масло, обжарьте курицу кусками.', 8),
    st('Добавьте лук, затем морковь, жарьте до мягкости.', 7),
    st('Всыпьте специи, посолите, влейте 700 мл кипятка и дайте покипеть.', 5),
    st('Разровняйте рис, вставьте головку чеснока. Не перемешивая, варите на среднем огне, пока вода не уйдёт.', 10),
    st('Сделайте проколы до дна, накройте крышкой и томите на минимальном огне.', 20),
  ]),

  r('borscht', 'Борщ', { time: 90, servings: 6, kcal: 290, tags: ['обед', 'впрок'], color: '#9E2B3A' }, [
    key('beet', 2, 'pcs'),
    key('cabbage', 400, 'g'),
    sec('beef', 500, 'g', [{ key: 'pork' }, { key: 'chicken_thigh' }]),
    sec('potato', 3, 'pcs'),
    sec('carrot', 1, 'pcs'),
    sec('onion', 1, 'pcs'),
    sec('tomato_paste', 40, 'g', [{ key: 'tomatoes_canned', qty: 200, unit: 'g' }]),
    sec('garlic', 2, 'pcs'),
    sec('dill', 15, 'g', [{ key: 'parsley' }]),
    sec('sour_cream', 100, 'g'),
    basic('bay_leaf'), basic('vinegar', 1, 'tbsp'), basic('vegetable_oil', 2, 'tbsp'), basic('salt'),
  ], [
    st('Залейте мясо 2,5 л воды, доведите до кипения, снимите пену и варите бульон.', 50),
    st('Натрите свёклу и морковь, нарежьте лук. Обжарьте на масле, добавьте томатную пасту и уксус, тушите.', 10),
    st('Добавьте в бульон картофель кубиками.', 10),
    st('Добавьте нашинкованную капусту.', 7),
    st('Переложите зажарку, добавьте лавровый лист и чеснок, посолите. Варите на слабом огне.', 7),
    st('Дайте настояться под крышкой и подавайте со сметаной и укропом.', 15),
  ]),

  r('navy-pasta', 'Макароны по-флотски', { time: 30, servings: 4, kcal: 590, tags: ['ужин', 'быстро'], color: '#A7683F' }, [
    key('pasta', 400, 'g'),
    key('minced_meat', 500, 'g', [{ key: 'minced_chicken' }]),
    sec('onion', 1, 'pcs'),
    sec('tomato_paste', 30, 'g', [{ key: 'ketchup', qty: 40, unit: 'g' }]),
    basic('vegetable_oil', 2, 'tbsp'), basic('salt'), basic('black_pepper'),
  ], [
    st('Отварите макароны в подсолённой воде.', 10),
    st('Одновременно обжарьте лук на масле.', 3),
    st('Добавьте фарш, разбивая комочки, жарьте до готовности.', 10),
    st('Вмешайте томатную пасту и немного воды от макарон, посолите и поперчите.', 2),
    st('Смешайте с макаронами.'),
  ]),

  r('chicken-cutlets', 'Куриные котлеты', { time: 35, servings: 4, kcal: 380, tags: ['ужин', 'впрок'], color: '#C98B4E' }, [
    key('minced_chicken', 600, 'g', [{ key: 'minced_meat' }, { key: 'chicken_breast' }]),
    sec('onion', 1, 'pcs'),
    sec('egg', 1, 'pcs'),
    sec('bread', 60, 'g', [{ key: 'oats', qty: 40, unit: 'g' }]),
    sec('garlic', 1, 'pcs'),
    basic('vegetable_oil', 3, 'tbsp'), basic('salt'), basic('black_pepper'),
  ], [
    st('Хлеб замочите в воде или молоке, отожмите. Лук и чеснок мелко натрите.'),
    st('Смешайте фарш с хлебом, луком, яйцом, солью и перцем. Отбейте массу о миску.'),
    st('Мокрыми руками сформируйте котлеты.'),
    st('Обжарьте с двух сторон на среднем огне.', 8),
    st('Добавьте 50 мл воды, накройте крышкой и потушите.', 8),
  ]),

  r('mashed-potatoes', 'Картофельное пюре', { time: 30, servings: 4, kcal: 230, tags: ['гарнир'], color: '#EAD9A8' }, [
    key('potato', 1000, 'g'),
    sec('milk', 150, 'ml', [{ key: 'cream' }]),
    sec('butter', 40, 'g'),
    basic('salt'),
  ], [
    st('Очистите картофель, нарежьте крупно, залейте водой и посолите.'),
    st('Варите до мягкости.', 20),
    st('Слейте воду, добавьте горячее молоко и масло, разомните толкушкой.'),
  ]),

  r('buckwheat-mushrooms', 'Гречка с грибами и луком', { time: 30, servings: 3, kcal: 390, tags: ['обед', 'ужин'], color: '#7E5C40' }, [
    key('buckwheat', 250, 'g'),
    key('mushrooms', 300, 'g'),
    sec('onion', 1, 'pcs'),
    sec('sour_cream', 60, 'g', [{ key: 'cream', qty: 60, unit: 'ml' }]),
    sec('butter', 20, 'g'),
    basic('vegetable_oil', 1, 'tbsp'), basic('salt'),
  ], [
    st('Промойте гречку, залейте 500 мл воды, посолите и варите под крышкой.', 18),
    st('Обжарьте лук на масле до прозрачности.', 4),
    st('Добавьте грибы и жарьте, пока не уйдёт жидкость.', 8),
    st('Смешайте гречку с грибами, маслом и сметаной.'),
  ]),

  r('veg-salad-sour-cream', 'Овощной салат со сметаной', { time: 10, servings: 2, kcal: 140, tags: ['гарнир', 'быстро'], color: '#6FA25A' }, [
    key('cucumber', 2, 'pcs'),
    key('tomato', 2, 'pcs'),
    sec('dill', 10, 'g', [{ key: 'parsley' }, { key: 'green_onion' }]),
    sec('sour_cream', 60, 'g', [{ key: 'yogurt' }, { key: 'olive_oil', qty: 2, unit: 'tbsp' }]),
    basic('salt'),
  ], [
    st('Нарежьте огурцы и помидоры, мелко порубите зелень.'),
    st('Посолите, заправьте сметаной прямо перед подачей.'),
  ]),

  r('fried-potatoes-mushrooms', 'Жареная картошка с грибами', { time: 35, servings: 3, kcal: 420, tags: ['ужин'], color: '#C79A52' }, [
    key('potato', 800, 'g'),
    sec('mushrooms', 300, 'g'),
    sec('onion', 1, 'pcs'),
    sec('dill', 10, 'g', [{ key: 'green_onion' }, { key: 'parsley' }]),
    basic('vegetable_oil', 4, 'tbsp'), basic('salt'),
  ], [
    st('Нарежьте картофель брусками, обсушите полотенцем.'),
    st('Отдельно обжарьте грибы с луком до румяности.', 8),
    st('На раскалённом масле жарьте картофель, не перемешивая первые минуты.', 10),
    st('Перемешайте, добавьте грибы с луком, посолите и доведите до готовности.', 8),
    st('Посыпьте зеленью.'),
  ]),

  r('lazy-cabbage-rolls', 'Ленивые голубцы', { time: 50, servings: 4, kcal: 430, tags: ['ужин', 'впрок'], color: '#B7603E' }, [
    key('minced_meat', 500, 'g', [{ key: 'minced_chicken' }]),
    key('cabbage', 400, 'g'),
    sec('rice', 100, 'g'),
    sec('onion', 1, 'pcs'),
    sec('carrot', 1, 'pcs'),
    sec('tomato_paste', 40, 'g', [{ key: 'tomatoes_canned', qty: 200, unit: 'g' }]),
    sec('sour_cream', 100, 'g'),
    basic('vegetable_oil', 2, 'tbsp'), basic('salt'), basic('black_pepper'),
  ], [
    st('Отварите рис до полуготовности.', 8),
    st('Мелко нашинкуйте капусту, смешайте с фаршем, рисом, солью и перцем. Сформируйте тефтели.'),
    st('Обжарьте лук и морковь, добавьте томатную пасту, сметану и 400 мл воды.', 5),
    st('Уложите тефтели в соус, накройте крышкой и тушите.', 30),
  ]),

  r('egg-toast', 'Гренки с яйцом и сыром', { time: 15, servings: 2, kcal: 420, tags: ['завтрак', 'быстро'], color: '#DDAE62' }, [
    key('bread', 200, 'g'),
    key('egg', 2, 'pcs'),
    sec('milk', 80, 'ml', [{ key: 'kefir' }]),
    sec('cheese', 50, 'g'),
    sec('butter', 20, 'g', [{ key: 'vegetable_oil', qty: 2, unit: 'tbsp' }]),
    basic('salt'),
  ], [
    st('Взбейте яйца с молоком и солью.'),
    st('Обмакните ломтики хлеба в смесь с двух сторон.'),
    st('Обжарьте на сливочном масле, переверните и посыпьте сыром.', 4),
    st('Накройте крышкой, чтобы сыр расплавился.', 1),
  ]),

  r('creamy-chicken-broccoli', 'Курица в сливочном соусе с брокколи', { time: 30, servings: 3, kcal: 470, tags: ['ужин'], color: '#D9C28A' }, [
    key('chicken_breast', 500, 'g', [{ key: 'chicken_thigh' }]),
    key('cream', 200, 'ml', [{ key: 'sour_cream', qty: 200, unit: 'g' }, { key: 'cream_cheese', qty: 150, unit: 'g' }]),
    sec('broccoli', 300, 'g', [{ key: 'cauliflower' }, { key: 'frozen_vegetables' }, { key: 'zucchini', qty: 1, unit: 'pcs' }]),
    sec('garlic', 2, 'pcs'),
    sec('cheese', 40, 'g'),
    basic('vegetable_oil', 1, 'tbsp'), basic('salt'), basic('spices'),
  ], [
    st('Нарежьте курицу кусочками, брокколи разберите на соцветия.'),
    st('Обжарьте курицу на масле до румяности.', 6),
    st('Добавьте брокколи и чеснок.', 3),
    st('Влейте сливки, добавьте тёртый сыр, соль и специи. Потушите, пока соус не загустеет.', 8),
  ]),

  r('baked-salmon-veg', 'Лосось, запечённый с овощами', { time: 30, servings: 2, kcal: 450, tags: ['ужин', 'духовка'], color: '#E48A6A' }, [
    key('salmon', 400, 'g', [{ key: 'white_fish', qty: 500, unit: 'g' }]),
    sec('bell_pepper', 1, 'pcs'),
    sec('zucchini', 1, 'pcs', [{ key: 'broccoli', qty: 250, unit: 'g' }]),
    sec('lemon', 0.5, 'pcs'),
    basic('olive_oil', 2, 'tbsp'), basic('salt'), basic('spices'),
  ], [
    st('Разогрейте духовку до 200 °C. Нарежьте овощи крупными кусками.'),
    st('Сбрызните овощи маслом, посолите и запекайте.', 10),
    st('Добавьте рыбу, посолите, полейте лимонным соком.'),
    st('Запекайте до готовности рыбы.', 15),
  ]),

  r('eggs-tomatoes', 'Яичница с помидорами', { time: 10, servings: 2, kcal: 280, tags: ['завтрак', 'быстро'], color: '#E36B4A' }, [
    key('egg', 4, 'pcs'),
    sec('tomato', 2, 'pcs'),
    sec('green_onion', 10, 'g', [{ key: 'dill' }, { key: 'parsley' }]),
    sec('butter', 10, 'g', [{ key: 'vegetable_oil', qty: 1, unit: 'tbsp' }]),
    basic('salt'),
  ], [
    st('Нарежьте помидоры кружками и обжарьте на масле.', 2),
    st('Разбейте яйца, посолите, накройте крышкой и жарьте.', 4),
    st('Посыпьте зелёным луком.'),
  ]),

  r('banana-pancakes', 'Банановые панкейки', { time: 20, servings: 2, kcal: 390, tags: ['завтрак'], color: '#E9C46A' }, [
    key('banana', 2, 'pcs'),
    key('egg', 2, 'pcs'),
    sec('flour', 60, 'g', [{ key: 'oats' }]),
    sec('milk', 100, 'ml', [{ key: 'kefir' }]),
    basic('baking_powder', 1, 'tsp'), basic('vegetable_oil', 1, 'tbsp'),
  ], [
    st('Разомните бананы в пюре, смешайте с яйцами и молоком.'),
    st('Добавьте муку с разрыхлителем, перемешайте.'),
    st('Жарьте небольшие панкейки на слегка смазанной сковороде с двух сторон.', 6),
  ]),

  r('lentil-soup', 'Чечевичный суп', { time: 40, servings: 4, kcal: 280, tags: ['обед', 'впрок'], color: '#C4722E' }, [
    key('lentils', 250, 'g'),
    sec('onion', 1, 'pcs'),
    sec('carrot', 1, 'pcs'),
    sec('potato', 2, 'pcs'),
    sec('tomato_paste', 30, 'g', [{ key: 'tomatoes_canned', qty: 200, unit: 'g' }]),
    sec('garlic', 2, 'pcs'),
    basic('vegetable_oil', 2, 'tbsp'), basic('spices'), basic('salt'),
  ], [
    st('Обжарьте лук, морковь и чеснок на масле в кастрюле.', 5),
    st('Добавьте томатную пасту и специи.', 1),
    st('Всыпьте промытую чечевицу и картофель кубиками, залейте 1,5 л воды.'),
    st('Варите до мягкости чечевицы, посолите в конце.', 25),
  ]),

  r('chicken-caesar', 'Салат «Цезарь» с курицей', { time: 25, servings: 2, kcal: 520, tags: ['обед', 'ужин'], color: '#A9C27A' }, [
    key('chicken_breast', 300, 'g'),
    key('lettuce', 200, 'g'),
    sec('bread', 80, 'g'),
    sec('cheese', 40, 'g'),
    sec('tomato', 2, 'pcs'),
    sec('mayonnaise', 60, 'g', [{ key: 'yogurt', qty: 80, unit: 'g' }, { key: 'sour_cream' }]),
    sec('garlic', 1, 'pcs'),
    sec('lemon', 0.5, 'pcs'),
    basic('olive_oil', 2, 'tbsp'), basic('salt'),
  ], [
    st('Обжарьте куриное филе с солью на масле с двух сторон.', 10),
    st('Нарежьте хлеб кубиками и подсушите на сковороде.', 4),
    st('Для соуса смешайте майонез, тёртый чеснок, лимонный сок и немного сыра.'),
    st('Порвите салат, добавьте нарезанные курицу и помидоры, сухарики, полейте соусом и посыпьте сыром.'),
  ]),

  r('dumplings', 'Пельмени со сметаной', { time: 15, servings: 2, kcal: 620, tags: ['ужин', 'быстро'], color: '#E6DCC4' }, [
    key('dumplings', 500, 'g'),
    sec('sour_cream', 100, 'g'),
    sec('butter', 20, 'g'),
    sec('dill', 10, 'g', [{ key: 'parsley' }, { key: 'green_onion' }]),
    basic('bay_leaf'), basic('salt'),
  ], [
    st('Вскипятите 2 л воды с солью и лавровым листом.'),
    st('Опустите пельмени, помешайте. После всплытия варите.', 5),
    st('Выньте шумовкой, добавьте масло, зелень и сметану.'),
  ]),

  r('cottage-casserole', 'Творожная запеканка', { time: 50, servings: 4, kcal: 330, tags: ['завтрак', 'духовка', 'впрок'], color: '#EBC27D' }, [
    key('cottage_cheese', 500, 'g'),
    key('egg', 2, 'pcs'),
    sec('flour', 50, 'g', [{ key: 'oats' }]),
    sec('sour_cream', 100, 'g', [{ key: 'yogurt' }]),
    basic('sugar', 3, 'tbsp'), basic('baking_powder', 1, 'tsp'), basic('salt'),
  ], [
    st('Разогрейте духовку до 180 °C.'),
    st('Смешайте творог, яйца, сахар, сметану, муку и разрыхлитель до однородности.'),
    st('Переложите в смазанную форму и разровняйте.'),
    st('Запекайте до золотистого верха.', 35),
    st('Дайте остыть, чтобы запеканка схватилась.', 10),
  ]),

  // ——— Смузи и напитки (TheCocktailDB вдохновение) ———
  r('banana-milkshake', 'Банановый молочный коктейль', { time: 5, servings: 2, kcal: 190, tags: ['напиток', 'завтрак', 'сладкое'], color: '#E5C058' }, [
    key('banana', 1, 'pcs'),
    key('milk', 300, 'ml', [{ key: 'yogurt' }]),
    sec('honey', 1, 'tbsp', [{ key: 'sugar' }]),
  ], [
    st('Очистите банан и нарежьте кружочками.'),
    st('Поместите в блендер банан, охлаждённое молоко и ложку мёда или сахара.'),
    st('Взбивайте 1–2 минуты на высокой скорости до пышной пенки.', 2),
    st('Разлейте по высоким стаканам и подавайте сразу.'),
  ]),

  r('berry-banana-smoothie', 'Ягодно-банановый смузи', { time: 5, servings: 2, kcal: 155, tags: ['напиток', 'завтрак', 'десерт'], color: '#B33C57' }, [
    key('frozen_berries', 150, 'g'),
    key('banana', 1, 'pcs'),
    sec('yogurt', 150, 'g', [{ key: 'milk' }]),
    basic('honey', 1, 'tbsp'),
  ], [
    st('Засыпьте ягоды и кусочки банана в чашу блендера.'),
    st('Добавьте йогурт (или молоко) и ложку мёда по вкусу.'),
    st('Взбейте до гладкой кремовой текстуры.', 1.5),
    st('Перелейте в бокалы. Можно украсить листочком мяты.'),
  ]),

  r('fresh-lemonade', 'Освежающий домашний лимонад', { time: 10, servings: 4, kcal: 75, tags: ['напиток', 'лето', 'впрок'], color: '#E8D44D' }, [
    key('lemon', 2, 'pcs', [{ key: 'orange' }]),
    sec('mint', 10, 'g'),
    basic('sugar', 3, 'tbsp'),
  ], [
    st('Выжмите сок из 2 лимонов в кувшин.'),
    st('Разомните листочки свежей мяты с сахаром на дне кувшина, чтобы пошёл аромат.'),
    st('Влейте лимонный сок и 800 мл холодной чистой воды (или газировки).'),
    st('Перемешайте до растворения сахара и бросьте кубики льда.'),
  ]),

  r('apple-orange-fresh', 'Витаминный яблочно-апельсиновый смузи', { time: 5, servings: 2, kcal: 120, tags: ['напиток', 'завтрак'], color: '#E07C38' }, [
    key('orange', 1, 'pcs'),
    key('apple', 1, 'pcs'),
    sec('carrot', 1, 'pcs'),
  ], [
    st('Очистите апельсин от кожуры и семян.'),
    st('Нарежьте яблоко и морковь небольшими кусочками.'),
    st('Сложите в блендер, добавьте 100 мл холодной воды и взбейте до однородности.', 2),
    st('Подавайте сразу для максимальной пользы витаминов.'),
  ]),

  r('virgin-mojito', 'Безалкогольный мохито', { time: 5, servings: 2, kcal: 50, tags: ['напиток', 'лето'], color: '#3BA068' }, [
    key('lemon', 1, 'pcs'),
    key('mint', 15, 'g'),
    basic('sugar', 2, 'tsp'),
  ], [
    st('Нарежьте половинку лимона или лайма дольками и положите в стакан.'),
    st('Добавьте свежие листочки мяты и 2 чайные ложки сахара.'),
    st('Аккуратно разомните мадлером или ложкой прямо в бокале.'),
    st('Засыпьте лед до верха и залейте газированной водой.'),
  ]),
  ...EXTENDED_RECIPES,
];
