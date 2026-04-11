"""Reset guestbook and seed it with realistic visitor-style messages."""

from __future__ import annotations

import sqlite3
from pathlib import Path


DB_PATH = Path(__file__).resolve().parents[1] / "neo.db"


ENTRIES: list[tuple[str, str]] = [
    ("Aurelius", "A quietly elegant corner of the internet. 愿你的创造力始终稳定而丰盛。"),
    ("Hypatia", "There is clarity here. 读完之后，让人很想认真生活，也认真思考。"),
    ("Leonardo", "Your site feels like a studio of thought. Keep building with grace and precision."),
    ("Sappho", "很少见到这样克制又有气质的个人站，祝你灵感常来，表达常新。"),
    ("Rumi", "There is a calm intelligence in these pages. 愿你始终向内丰盈，向外明亮。"),
    ("Virgil", "A refined digital presence. 愿你的每一步都稳稳落在理想之上。"),
    ("Ada", "Beautiful work. Precision in structure, warmth in tone, and a strong point of view."),
    ("Galileo", "在喧闹的信息流里，这里像一盏安静的灯。祝你长期主义，诸事有成。"),
    ("Beatrice", "So tasteful, so composed. 愿你热爱的事，也同样温柔地回报你。"),
    ("Tagore", "The atmosphere here is serene and luminous. 愿你一直保持敏锐与善意。"),
    ("Murasaki", "静かで美しい空気があります。願わくは、あなたの歩みがいつも自分らしくありますように。"),
    ("Pascal", "A rare combination of discipline and tenderness. 祝你写下的东西都被懂得。"),
    ("Curie", "有力量，也有分寸感。这样的表达会被记住的。"),
    ("Bach", "Everything feels well-composed here. 愿你的作品像音乐一样，越听越有余韵。"),
    ("Austen", "Graceful and thoughtful. Hope this place keeps attracting kind and intelligent visitors."),
    ("Du Fu", "页面很稳，内容很实。愿你胸中有丘壑，手中有成果。"),
    ("Wang Wei", "行到深处见风景。这个网站给人的感觉，也是如此。"),
    ("Li Bai", "愿你心里有月光，代码里有锋芒，生活里有酒和远方。"),
    ("Montaigne", "A personal site should feel personal; yours certainly does, and beautifully so."),
    ("Homer", "这不是一眼惊艳的喧哗，而是越看越觉得有分量。"),
    ("Erasmus", "Subtle, intelligent, and memorable. 愿你做的事，都有回响。"),
    ("Raphael", "Un sitio con mucha elegancia. Que tu trabajo siga creciendo con calma y brillo."),
    ("Cervantes", "读到这里，能感受到一种稳定的审美和判断力。很难得。"),
    ("Dante", "Lasciate entrare la bellezza e la disciplina. 祝你所行之路，渐入佳境。"),
    ("Benedict", "A fine balance between craft and personality. Keep going; it already feels distinguished."),
    ("Raffaello", "Molto raffinato. Spero che ogni tua idea trovi il suo tempo, il suo luogo, il suo pubblico."),
    ("Socrates", "真正高级的东西往往不吵闹，这里就是一个例子。"),
    ("Plato", "A thoughtful design speaks before words do. Yours speaks well."),
    ("Aristotle", "愿你保持方法，也保持热爱；保持判断，也保持温度。"),
    ("Cicero", "This site has poise. Not merely built, but considered."),
    ("Seneca", "日子很快，表达很难，而你把两者都处理得不错。"),
    ("Marcus", "Discipline without stiffness, elegance without excess. 很高级。"),
    ("Helena", "Bonjour depuis un lecteur inconnu. Ce site a une vraie tenue, sobre et inspirante."),
    ("Camus", "There is restraint here, and therefore style. 愿你一直拥有自己的节奏。"),
    ("Simone", "愿你始终不被喧嚣绑架，也不被短期反馈左右。"),
    ("Voltaire", "Clarity is a form of elegance. This place understands that."),
    ("Moliere", "Un site avec du caractère. Sobre, net, et plein de présence."),
    ("Richelieu", "你把个人表达做得很像作品，而不是素材堆叠，这点很珍贵。"),
    ("Heloise", "A gentle greeting from afar. 祝你持续创作，也持续被世界温柔接住。"),
    ("Goethe", "Talent is visible; temperament is rarer. Both seem present here."),
    ("Schiller", "这份克制感和完整度，真的会让人留下印象。"),
    ("Heine", "Sehr stilvoll. Möge dein Werk weiter wachsen, leise und kraftvoll zugleich."),
    ("Kant", "在很多人追求热闹的时候，你保留了秩序感。很难得。"),
    ("Nietzsche", "Style is also courage. This site shows both thought and nerve."),
    ("Hesse", "希望你永远保有独处时的丰盈，以及出发时的果断。"),
    ("Kafka", "Quiet pages often hold the deepest signal. Yours certainly does."),
    ("Mozart", "有一种轻盈的高级感，不费力，却准确。"),
    ("Mahler", "This feels less like a page and more like a personal chamber of ideas."),
    ("Debussy", "像一段有留白的乐句，柔和，但不空。"),
    ("Bergson", "愿你的时间花在真正值得的事情上，且总有余韵。"),
    ("Hafiz", "A lovely place to pause. 愿你所有长期投入，最终都成为光。"),
    ("Rafael", "Muy bonito, muy limpio, muy tuyo. Eso es difícil de lograr."),
    ("Isabella", "你的站点有一种“慢慢读”的气质，这在今天尤其珍贵。"),
    ("Sophia", "Clean, intelligent, and memorable. Wishing you sustained momentum and deep joy in the work."),
    ("Julian", "看得出来不是随手做做，而是认真经营的表达空间。"),
    ("Catherine", "Une présence discrète mais forte. J'aime beaucoup l'équilibre ici."),
    ("Elena", "风格很统一，节奏也很舒服。这样的站会让人愿意常回来。"),
    ("Aurora", "Hope this space keeps evolving with the same confidence and quiet beauty."),
    ("Victoria", "高级感不是堆出来的，是取舍出来的。这里做到了。"),
    ("Lucien", "Ce site donne envie de lire lentement. C'est un compliment rare."),
    ("Isolde", "有些页面会让人迅速划走，这里会让人停住。"),
    ("Octavia", "Strong taste, clear voice, and no unnecessary noise. Admirable."),
    ("Penelope", "愿你所有不动声色的努力，最终都被温柔看见。"),
    ("Orpheus", "这里像一个私人的展厅，安静，但不单薄。"),
    ("Helios", "A beautiful interface for a serious mind. Keep this standard high."),
    ("Minerva", "喜欢这里的节制与分寸，像是一个有教养的空间。"),
    ("Atlas", "The structure is excellent; the atmosphere is even better."),
    ("Odette", "Bonjour. Très belle atmosphère, très belle tenue. Continue comme ça."),
    ("Iris", "愿你的表达越来越自由，判断越来越锋利，生活越来越从容。"),
    ("Phoebe", "This feels curated rather than assembled. That difference is everything."),
    ("Thales", "很多人做网站是在展示信息，你更像是在建立气质。"),
    ("Euclid", "Order, proportion, and restraint. A quietly sophisticated result."),
    ("Ariadne", "希望以后每次来，都能看到一些新的光亮。"),
    ("Perseus", "Este sitio tiene presencia. Sobrio, elegante, y muy bien pensado."),
    ("Selene", "月色一样的页面感受。冷静、清澈，也有温度。"),
    ("Helene", "Un mot simple: distingué. C'est suffisamment rare pour être salué."),
    ("Neruda", "愿你保留诗意，也保留锋利；保留理想，也保留耐性。"),
    ("Santiago", "Se siente mucho cuidado en cada detalle. Eso siempre emociona."),
    ("Juliette", "读完想留一句：请继续这样做下去，不要被快节奏打断。"),
    ("Bianca", "A polished and deeply personal work. My compliments."),
    ("Armand", "高级感不是距离感，而是有判断的温柔。这里很像。"),
    ("Theo", "This is the kind of site that earns respect slowly and keeps it."),
    ("Lavinia", "愿你在技术与表达之间，越来越自如。"),
    ("Noah", "Clean lines, coherent tone, and a real sense of authorship. Excellent."),
    ("Estelle", "很喜欢这里的安静，不空，不冷，恰到好处。"),
    ("Milan", "A page with a mind of its own. That is rarer than people think."),
    ("Sabine", "希望你以后看到今天，也会觉得这些坚持很值得。"),
    ("Yuna", "とても上品な雰囲気ですね。これからも素敵な更新を楽しみにしています。"),
    ("Haruki", "言葉の温度がちょうどいいです。静かだけど、ちゃんと届きます。"),
    ("Aiko", "세련되고 차분한 느낌이 정말 좋네요. 오래 기억에 남을 사이트예요."),
    ("Minjun", "디자인도 좋고 내용도 탄탄해요. 앞으로도 꾸준히 이어가시길 바랍니다."),
    ("Elio", "C'è equilibrio qui. Eleganza, misura, e una voce personale molto chiara."),
    ("Lucia", "愿你所做的一切，不只是完成，而是逐渐成形、成风格。"),
    ("Matteo", "Molto bello davvero. Si vede attenzione, gusto, e un certo rigore."),
    ("Siena", "有审美的人很多，有分寸的人少。你这里两样都有。"),
    ("Rowan", "Not loud, not eager to impress, and therefore truly impressive."),
    ("Dorian", "愿你继续把时间花在真正会留下痕迹的事上。"),
    ("Elena V.", "This place feels both modern and cultivated. A rare combination."),
    ("Cassian", "很高级，不是因为复杂，而是因为干净和笃定。"),
    ("Lysander", "A graceful site with intellectual warmth. Thank you for making it public."),
    ("Ophelia", "希望你以后收获的不只是访问量，还有真正的共鸣。"),
    ("Nikolai", "Очень красиво и спокойно. Чувствуется характер, а не просто оформление."),
    ("Amal", "في هذا المكان هدوء راقٍ. أتمنى لك دوام الإلهام والاتساع."),
    ("Zeno", "最后留一句中文祝福：愿你长期发光，且始终从容。"),
]


def main() -> None:
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    selected_entries = ENTRIES[:100]

    # 中文: 用户明确要求清空全部留言后重建。
    # EN: Clear all guestbook entries first as explicitly requested by the user.
    cur.execute("DELETE FROM guestbook")

    cur.executemany(
        "INSERT INTO guestbook (nickname, visitor_id, message) VALUES (?, ?, ?)",
        [
            (nickname, f"seed-visitor-{index:03d}", message)
            for index, (nickname, message) in enumerate(selected_entries, start=1)
        ],
    )
    conn.commit()

    cur.execute("SELECT COUNT(*) FROM guestbook")
    total = cur.fetchone()[0]
    conn.close()

    print(f"Inserted {len(selected_entries)} guestbook entries.")
    print(f"Guestbook total: {total}")


if __name__ == "__main__":
    main()
