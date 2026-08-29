# Page Specification: 임플란트 랜딩 스크롤 장면

## 문서 목적과 우선순위

이 문서는 `gamdong-dental-landing/implant.html`의 데스크톱 스크롤 장면에 대한 구현 계약이다.

- 사용자가 대화에서 확정한 동작을 한곳에 고정한다.
- 구현을 다시 시작할 때 현재 코드의 동작을 정답으로 간주하지 않는다.
- 이 문서와 현재 구현이 충돌하면 이 문서를 우선한다.
- 이 문서와 일반 랜딩 규칙이 충돌하지 않는 범위에서 `landing-design-system`을 함께 적용한다.
- GSAP pin을 사용할 때는 `agent/pinning-guidelines.md`를 함께 적용한다.

## 사용자가 요구한 핵심 결과

1. 첫 번째 히어로 장면이 viewport를 완전히 채운 뒤 두 번째 섹션이 아래에서 위로 올라와 첫 번째 장면을 덮는다.
2. 두 번째 섹션의 임플란트는 처음 등장한 순간부터 마지막 장면까지 **동일한 이미지, 동일한 좌표, 동일한 크기**를 유지한다.
3. 같은 임플란트처럼 보이는 두 이미지를 겹친 뒤 `opacity`로 교체하지 않는다.
4. 배경 프레임만 전체 화면에서 둥근 카드로 축소된다.
5. 축소가 끝난 뒤 잠시 유지하고, 그 다음 배경 프레임만 위로 이동해 화면 밖으로 완전히 사라진다.
6. 임플란트는 배경 프레임의 자식이 아니므로 프레임이 축소되거나 이동해도 함께 움직이지 않는다.
7. 최종 문구는 배경 프레임이 완전히 사라진 뒤에만 나타난다.
8. 최종 임플란트의 크라운과 픽스처 끝이 어떤 데스크톱 비율에서도 잘리지 않아야 한다.
9. 최종 임플란트 주변에는 토스처럼 넓고 옅은 캔버스 기반의 공기감과 미세한 입자를 사용한다.
10. 단단하고 어두운 타원형 CSS 그림자는 사용하지 않는다.
11. 임플란트가 화면에 나타난 뒤에는 이동·전환·강조를 이유로 `scale`, `scaleX`, `scaleY`를 변경하지 않는다. 스크롤 진행 중 제품 크기가 달라지는 일은 어떤 구간에도 있어서는 안 된다.

## 현재 구현이 잘못된 이유

현재 코드는 아래 두 개의 서로 다른 임플란트 노드를 사용한다.

- 장면 내부 제품: `.implant-restoration-layer--implant`
- 최종 독립 제품: `.implant-precision-foreground`

현재 타임라인은 장면 내부 제품의 opacity를 낮추면서 최종 독립 제품의 opacity를 높인다. 두 소스의 여백, 비율, 기준점과 부모 좌표계가 달라서 전환 중 다음 문제가 발생한다.

- 임플란트가 두 개로 겹쳐 보인다.
- 크라운과 나사산의 위치가 미세하게 이동한다.
- 전환 전후 크기와 중심점이 달라진다.
- 빠르게 스크롤하면 반투명한 잔상이 보인다.
- 완성본으로 바뀌는 순간 사용자가 물체 교체를 인지한다.

따라서 현재 구현은 이 명세에 **불합격**이다. opacity 수치나 easing만 조정해서 해결하지 않는다. DOM과 이미지 소스 구조를 단일 제품 레이어 방식으로 바꿔야 한다.

## 토스에서 가져올 구조적 원칙

토스의 제품 장면을 실측했을 때 배경과 전경 제품은 서로 다른 레이어였다.

- 배경은 viewport 크기의 canvas이며 `clip-path`로 카드 형태까지 축소된다.
- 전경 휴대폰은 배경 canvas의 자식이 아닌 별도의 sticky canvas다.
- 배경 축소가 끝난 뒤 배경만 `translateY`로 위로 이동한다.
- 휴대폰은 같은 위치와 크기를 유지한다.
- 제품 주변의 빛과 입자는 CSS `box-shadow`나 `filter`가 아니라 canvas 안에서 렌더링된다.

1920 × 834 CSS px에서 실측한 배경 프레임의 최종 값은 다음과 같다.

```css
clip-path: inset(180px 160px round 80px);
```

다른 viewport에서는 이 숫자를 고정 복사하지 않고 같은 비례와 안전 여백을 유지한다.

## 필수 DOM 구조

제품은 전체 장면에서 하나만 존재해야 한다.

```html
<section class="implant-precision" data-implant-precision>
  <div class="implant-precision-sticky" data-implant-precision-sticky>
    <div class="implant-background-frame" data-implant-background-frame>
      <picture class="implant-background-photo">...</picture>
      <picture class="implant-holder-layer">...</picture>
      <span class="implant-background-shade"></span>
    </div>

    <canvas class="implant-product-ambient" data-implant-ambient></canvas>

    <picture class="implant-product" data-implant-product>
      <img src=".../implant-complete-alpha.png" alt="" />
    </picture>

    <div class="implant-copy implant-copy--benefit">...</div>
    <div class="implant-copy implant-copy--plan">...</div>
  </div>
</section>
```

다음 구조는 금지한다.

```html
<div class="shrinking-frame">
  <picture class="implant-version-a">...</picture>
</div>
<picture class="implant-version-b">...</picture>
```

## 이미지 소스 계약

### 배경

- 임플란트가 제거된 깨끗한 배경 소스를 사용한다.
- 배경은 프레임 안에서 `object-fit: cover`를 사용해도 된다.
- 배경 crop은 허용하지만 주요 텍스트 영역과 제품 대비가 깨지지 않아야 한다.

### 홀더와 장면 보조물

- 홀더가 필요하면 배경 프레임 내부의 별도 투명 레이어로 둔다.
- 홀더는 배경 프레임과 함께 축소되고 위로 퇴장한다.
- 홀더 이미지 안에 임플란트가 중복으로 포함되어 있으면 안 된다.
- 최초 장면 조립 시 임플란트와 홀더는 같은 마스터 좌표계, 같은 고정 보정 배율, 같은 결합 anchor를 사용한다.
- 임플란트와 홀더의 기본 크기를 줄여야 한다면 두 소스의 내용물을 같은 비율로 한 번만 축소하고 같은 벡터만큼 이동한다. 한쪽만 별도로 축소하거나 이동하지 않는다.
- 이 기본 보정은 asset 제작 단계 또는 layout 초기화 시 한 번 적용하는 정적 보정이다. scrub timeline에서 보정값을 바꾸지 않는다.

### 임플란트

- 크라운, 어버트먼트, 픽스처 끝까지 모두 포함된 투명 PNG/WebP 한 벌을 사용한다.
- 처음 장면과 마지막 장면에서 같은 파일을 사용한다.
- 투명 캔버스의 상하좌우 여백과 기준점을 변경한 별도 버전을 만들지 않는다.
- `object-fit: cover`를 절대 사용하지 않는다.
- 이미지의 원본 종횡비를 유지하고, viewport 안전 영역 안에 들어오도록 contain 계산을 사용한다.
- 제품 이미지의 opacity는 장면 전환용으로 애니메이션하지 않는다.
- 제품은 mask 또는 배경 프레임의 진입으로 처음 노출할 수 있지만, 노출된 뒤에는 `opacity: 1`을 유지한다.
- 제품이 처음 표시된 프레임부터 마지막 프레임까지 동일한 computed scale과 동일한 `getBoundingClientRect()` 크기를 유지한다.
- 제품 강조를 위해 `scale: 1.08` 같은 확대 tween을 추가하지 않는다. 강조는 배경, ambient canvas, 문구로 처리한다.
- 투명 캔버스 전체 크기가 아니라 알파가 실제로 존재하는 제품 bounding box를 화질 기준으로 사용한다.
- 최대 렌더링 크기의 최소 2배 픽셀 밀도를 가진 원본을 사용한다. 예를 들어 제품을 최대 400 × 600 CSS px로 표시하면 알파 제품 자체가 최소 800 × 1200 px이어야 한다.
- 저해상도 알파 이미지를 큰 투명 캔버스에 얹거나 단순 업스케일해 고해상도 소스로 간주하지 않는다.

### 주변 광원과 입자

- 임플란트와 같은 sticky 좌표계의 canvas를 사용한다.
- 넓고 낮은 대비의 청회색·중성색 radial gradient를 사용한다.
- 제품 바로 아래에 검은 타원을 두지 않는다.
- 미세 입자는 작은 반경과 낮은 alpha를 사용하며 개별 점이 먼저 눈에 띄면 실패다.
- canvas는 배경 프레임이 아니라 임플란트와 함께 화면에 남는다.

## 좌표계 계약

임플란트의 위치가 달라지는 문제를 막기 위한 가장 중요한 규칙이다.

- 배경 프레임, 임플란트, ambient canvas, 문구는 같은 `.implant-precision-sticky`의 직접 자식으로 둔다.
- 배경 프레임의 `clip-path`와 `translateY`가 임플란트의 좌표에 영향을 주면 안 된다.
- 임플란트의 기준점은 sticky viewport 기준의 하나의 anchor로만 계산한다.
- CSS의 `transform: translate(...)`와 GSAP의 `xPercent`, `yPercent`를 중복으로 사용하지 않는다.
- 초기 상태와 모든 타임라인 구간에서 같은 transform pipeline을 사용한다.
- resize 시 제품 크기와 anchor를 다시 계산할 수 있지만, 한 프레임 안에서 소스나 부모를 교체하지 않는다.
- 마스터 장면 좌표는 `1658 × 949`로 고정하고, 임플란트와 홀더의 결합 anchor는 같은 마스터 좌표 한 점으로 정의한다.
- 임플란트와 홀더의 정적 보정은 동일한 `assemblyScale`, `assemblyTranslateX`, `assemblyTranslateY`를 공유한다.
- `assemblyScale`은 layout 초기화 또는 `ScrollTrigger.refresh()` 때만 계산한다. 스크롤 progress, timeline label, 프레임 clip 상태로 변경하지 않는다.
- 프레임이 퇴장할 때 홀더는 배경 프레임의 부모 이동을 따르지만, 임플란트의 viewport anchor와 크기는 그대로 유지한다.

권장 계산은 다음과 같다.

```js
const safeWidth = stickyWidth - inlineSafeStart - inlineSafeEnd;
const safeHeight = stickyHeight - blockSafeStart - blockSafeEnd;
const layoutScale = Math.min(safeWidth / sourceWidth, safeHeight / sourceHeight);

productWidth = sourceWidth * layoutScale;
productHeight = sourceHeight * layoutScale;
productX = stickyWidth * productAnchorX;
productY = stickyHeight * productAnchorY;
```

여기서 `layoutScale`은 스크롤 애니메이션 값이 아니다. viewport가 바뀌어 layout을 다시 계산할 때만 갱신하며, 한 번의 스크롤 시퀀스 동안에는 상수다. 제품의 `productAnchorX`, `productAnchorY`도 장면 시작부터 끝까지 바꾸지 않는다.

## 데스크톱 스크롤 시퀀스

### 1. 히어로 유지

- 첫 번째 장면은 헤더 아래 viewport를 완전히 채운다.
- 필요한 히어로 내부 연출이 끝날 때까지 두 번째 섹션은 올라오지 않는다.

### 2. 두 번째 섹션의 덮기

- 두 번째 섹션이 viewport 아래에서 위로 이동한다.
- 첫 번째 히어로의 크기나 opacity를 줄이지 않는다.
- 두 번째 섹션의 불투명한 표면이 첫 번째 섹션을 물리적으로 가린다.

### 3. 진단 장면

- 진단 사진과 첫 번째 설명을 보여 준다.
- 다음 장면으로 넘어갈 때 제품을 다른 이미지로 교체하지 않는다.

### 4. 임플란트 장면

- 깨끗한 배경과 홀더를 배경 프레임 안에 표시한다.
- 단일 임플란트 레이어를 정해진 anchor에 표시한다.
- 임플란트가 표시된 순간부터 최종 장면까지 bounding box가 변하지 않아야 한다.

### 5. 배경 프레임 축소

- 배경 프레임만 `inset(0)`에서 둥근 카드 inset으로 변한다.
- 임플란트와 ambient canvas는 움직이거나 축소되지 않는다.
- 프레임 축소 중 임플란트 opacity를 변경하지 않는다.
- 프레임 축소가 100% 끝나기 전에는 프레임의 위쪽 이동을 시작하지 않는다.

### 6. 축소 상태 유지

- 카드가 완전히 축소된 모습을 짧게 읽을 수 있는 scroll 구간을 둔다.
- 이 구간에서도 제품 위치와 크기는 고정한다.

### 7. 배경 프레임 퇴장

- 축소된 배경 프레임만 `translateY`로 위로 이동한다.
- 프레임 안의 배경과 홀더는 함께 이동한다.
- 임플란트와 ambient canvas는 고정한다.
- 배경 프레임의 아래쪽 경계가 viewport 위쪽을 완전히 통과할 때까지 최종 문구를 보이지 않는다.

### 8. 최종 장면

- 배경 프레임이 완전히 사라진 뒤 최종 문구를 표시한다.
- 단일 임플란트와 ambient canvas는 이전 구간과 동일한 위치와 크기를 유지한다.
- 제품 하단에는 명확한 viewport 안전 여백이 남아야 한다.

## 애니메이션 구현 규칙

- 하나의 scrubbed GSAP timeline으로 순서를 관리한다.
- 각 단계는 label로 명시한다: `hero-complete`, `section-cover`, `implant-scene`, `frame-shrink`, `frame-hold`, `frame-exit`, `final-copy`.
- 제품 요소에 대한 `autoAlpha`, `opacity`, `visibility` tween을 만들지 않는다.
- 제품 요소에 대한 `scale`, `scaleX`, `scaleY` tween을 만들지 않는다.
- 제품의 `transform` tween에 scale 성분을 섞지 않는다. 필요한 이동도 원칙적으로 금지하며, 고정된 viewport anchor를 유지한다.
- 배경 프레임의 clip과 이동은 동시에 진행하지 않는다.
- `frame-exit` 완료 콜백에 의존하지 말고 timeline 위치로 `final-copy` 시작점을 고정한다.
- 빠른 스크롤과 역방향 스크롤에서도 같은 장면이 정확히 복원되어야 한다.
- `invalidateOnRefresh: true`를 사용하고 함수 기반 값을 refresh 때 다시 계산한다.

## 반응형과 fallback

- desktop `>64rem`: 이 문서의 pinned scroll scene을 사용한다.
- compact와 medium `≤64rem`: pin과 scrub을 제거하고 자연 문서 흐름의 정적 카드로 보여 준다.
- desktop에서도 pin 최소 높이를 충족하지 못하면 자연 흐름 fallback을 사용한다.
- 제품 크기는 viewport 폭만으로 정하지 않고 사용 가능한 폭과 높이를 모두 사용해 계산한다.
- 1920×짧은 화면 같은 ultrawide 환경에서도 크라운과 픽스처 끝이 모두 보여야 한다.
- `prefers-reduced-motion: reduce`에서는 정적 최종 상태 또는 자연 흐름을 제공한다.

## 금지 사항

- 같은 제품의 A 이미지와 B 이미지를 opacity crossfade로 교체하기
- 한 제품 이미지를 숨긴 뒤 다른 제품 이미지를 갑자기 표시하기
- 제품을 shrinking frame 안에 넣었다가 최종 단계에 DOM 또는 부모를 바꾸기
- 서로 다른 원본 여백을 가진 제품 이미지를 같은 위치라고 가정하기
- 알파 제품 이미지에 `object-fit: cover` 적용하기
- 임플란트 등장 이후 timeline에서 제품 scale을 변경하기
- 제품 강조를 zoom-in 또는 zoom-out으로 표현하기
- 임플란트와 홀더에 서로 다른 기본 보정 scale 또는 서로 다른 결합 anchor 적용하기
- 프레임 크기에 따라 제품 anchor가 움직이게 만들기
- 프레임 축소와 프레임 퇴장을 동시에 실행하기
- 배경이 남아 있는데 최종 문구를 먼저 표시하기
- 제품 아래에 진하고 경계가 뚜렷한 타원형 그림자 사용하기
- 현재 화면 한 크기에서만 맞는 고정 `top`, `left`, `scale` 조합 사용하기

## 소스 파일 책임

- `gamdong-dental-landing/implant.html`: 단일 제품 DOM과 배경 프레임 형제 구조
- `gamdong-dental-landing/src/implant.css`: sticky 좌표계, z-index, contain 크기, fallback
- `gamdong-dental-landing/src/implant.js`: scroll state machine, clip 계산, frame 이동, canvas 렌더링
- `gamdong-dental-landing/assets/images/`: 중복 제품이 없는 배경·홀더·단일 완성 제품 원본

## 픽셀 검수 기준

아래 milestone에서 임플란트의 `getBoundingClientRect()`를 기록한다.

1. 임플란트 장면 진입 직후
2. 배경 프레임 축소 50%
3. 배경 프레임 축소 완료
4. 배경 프레임 퇴장 50%
5. 배경 프레임 완전 퇴장
6. 최종 문구 표시 완료

모든 milestone에서 다음을 만족해야 한다.

- 제품의 `x`, `y`, `width`, `height` 차이가 각각 1 CSS px 이내다.
- 제품의 computed transform에서 scale 성분이 모든 milestone에서 동일하다.
- 제품의 computed opacity는 항상 `1`이다.
- 화면에 보이는 임플란트 제품 노드는 정확히 하나다.
- 크라운 상단과 픽스처 하단이 viewport 안에 있다.
- 제품 하단 안전 여백이 음수가 아니다.

추가 순서 검사는 다음과 같다.

- 프레임 축소 완료 전 `translateY`는 0이다.
- 프레임 퇴장 중 최종 문구 opacity는 0이다.
- 최종 문구가 보이기 시작할 때 배경 프레임의 `bottom <= 0`이다.
- 역방향 스크롤에서도 같은 조건이 역순으로 성립한다.

## 필수 viewport 검사

- 1920 × 대표 데스크톱 높이
- 1440 × 대표 데스크톱 높이
- 1288 × 747
- 1024 × 대표 태블릿 높이: 정적 fallback
- 768 × 대표 태블릿 높이: 정적 fallback
- 390 × 대표 모바일 높이: 정적 fallback
- pin 최소 높이 `-1px`, 정확한 값, `+1px`
- 200% text resize
- 400% browser zoom

## 완료 조건

- [ ] 단일 임플란트 이미지 노드만 사용한다.
- [ ] 제품 교체용 opacity tween이 없다.
- [ ] 제품에 `scale`, `scaleX`, `scaleY` tween이 없다.
- [ ] 임플란트와 홀더가 동일한 정적 보정 scale과 동일한 결합 anchor를 사용한다.
- [ ] 배경 프레임과 제품이 같은 sticky root의 형제다.
- [ ] 프레임 축소 중 제품 bounding box가 변하지 않는다.
- [ ] 프레임 퇴장 중 제품 bounding box가 변하지 않는다.
- [ ] 배경 프레임이 완전히 사라진 뒤 최종 문구가 나타난다.
- [ ] 최종 제품의 크라운과 픽스처 끝이 잘리지 않는다.
- [ ] canvas 광원은 넓고 옅으며 개별 입자가 먼저 보이지 않는다.
- [ ] compact, medium, reduced-motion에서 자연 흐름 fallback이 동작한다.
- [ ] 페이지 전체 수평 overflow와 콘솔 오류가 없다.
