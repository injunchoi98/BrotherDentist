# Page Specification: 임플란트 랜딩 스크롤 장면

## 목적과 우선순위

이 문서는 `implant.html`의 데스크톱 스크롤 장면에 대한 구현 계약이다.

- 사용자가 대화에서 확정한 동작을 현재 코드보다 우선한다.
- 공통 랜딩 규칙과 `agent/pinning-guidelines.md`를 함께 적용한다.
- 이 장면은 토스의 “합성 장면 프레임이 축소·퇴장하며 아래 제품이 드러나는 구조”를 따른다.

## 최종 구조

장면에는 같은 마스터 좌표계를 공유하는 이미지 A와 B가 있다.

### 이미지 A: 합성 장면

- 배경, 임플란트, 지지대를 한 장에 합성한 불투명 이미지다.
- 지지대는 A에 구워 넣으며 별도 DOM 레이어로 만들지 않는다.
- A만 전체 화면에서 둥근 카드로 클리핑되고, 이후 위로 퇴장한다.

### 이미지 B: 임플란트 마스터

- A와 동일한 캔버스 크기의 투명 이미지다.
- A에 합성한 것과 동일한 임플란트 픽셀만 동일 좌표에 남긴다.
- 크라운부터 픽스처 끝까지 온전하게 포함한다.
- A 아래에 놓이며 A가 클리핑될 때 드러난다.
- 장면 진입이 끝난 뒤에는 위치, 크기, opacity를 변경하지 않는다.

현재 확정 자산은 다음과 같다.

- A: `implant-restoration-lab-v1-2x.png` (`3316 × 1898`), `implant-restoration-lab-v2-ai.png`를 원본으로 사용한다. 기존 실험실 구도는 유지하고 임플란트만 더 작게 다시 렌더링한 2배 픽셀 소스다.
- B: `implant-restoration-product-master-2x-alpha.png` (`3316 × 1898`)
- 공통 CSS 마스터 좌표: `1658 × 949`
- B는 새 A의 제품 픽셀을 직접 마스킹해 사용하며, 가려진 뿌리 끝만 같은 픽셀 안에서 테이퍼 처리한다.
- B의 2x 제품 픽셀 박스: `left 1979`, `top 398`, `width 386`, `height 955`
- 크라운은 A의 내부/경계/배경 트라이맵과 곡선 보간 외곽으로 추출한다. 확정된 외곽에 median 필터를 적용하지 않고 2× Lanczos 리샘플링으로 1px 알파 램프를 만든다.
- 픽스처는 A와 겹치는 구간을 그대로 유지하고, 지지대에 가려진 끝부분만 마스터 좌표에서 26px(2x 자산에서 52px) 연장한다.
- 자산 재생성: `scripts/create-implant-scene-master.mjs`
- A는 원본 장면 전체를 한 번에 2배화하며 제품과 지지대를 별도로 재배치하지 않는다.
- B는 A 안 제품의 크라운 상단과 좌우 폭에 맞춰 자산 생성 단계에서 한 번만 정렬한다.

## 핵심 결과

1. 첫 번째 히어로가 viewport를 채운 뒤 두 번째 섹션이 아래에서 위로 덮는다.
2. 두 번째 장면 진입 시 A와 B가 같은 이동값으로 함께 올라온다.
3. 진입이 끝나면 B는 마지막 장면까지 같은 viewport 좌표와 크기를 유지한다.
4. A만 `clip-path`로 축소된다.
5. 축소가 끝난 뒤 유지 구간을 거쳐 A만 위로 완전히 퇴장한다.
6. 최종 문구는 A의 아래 경계가 viewport 위를 완전히 통과한 뒤 나타난다.
7. A와 B를 opacity crossfade로 교체하지 않는다.
8. B에 스크롤 진행값 기반 `scale`, `scaleX`, `scaleY`를 적용하지 않는다.
9. 제품의 크라운과 픽스처 끝은 지원하는 모든 데스크톱 비율에서 잘리지 않는다.
10. 광원과 입자는 B와 같은 sticky 좌표계에 남고, A가 사라진 뒤에도 유지된다.

## 필수 DOM 관계

```html
<div class="implant-precision-sticky">
  <div class="implant-product-light-plane">...</div>

  <div class="implant-product-plane">
    <div class="implant-product-stage">
      <picture class="implant-product">B</picture>
    </div>
  </div>

  <div class="implant-precision-reveal">
    <div class="implant-restoration-stage">
      <picture class="implant-restoration-scene">A</picture>
    </div>
    <span class="implant-precision-scene-shade"></span>
  </div>

  <div class="implant-precision-copy">...</div>
</div>
```

- light plane, product plane, reveal frame, copy는 sticky root의 직접 자식이다.
- A의 z-index는 B보다 높다.
- A와 B의 stage는 같은 CSS 변수를 사용한다.
- shade는 A의 reveal 안에 있어 A와 함께 클리핑되고 퇴장한다.

## 좌표계 계약

A와 B에는 단 하나의 cover 변환만 적용한다.

```js
sceneScale = Math.max(
  stickyWidth / 1658,
  stickyHeight / 949,
);

sceneX = (stickyWidth - 1658 * sceneScale) / 2;
sceneY = (stickyHeight - 949 * sceneScale) / 2;
```

두 stage는 아래 변수를 동시에 상속한다.

```css
--restoration-stage-scale
--restoration-stage-x
--restoration-stage-y
```

- A와 B에 별도의 `object-position`, 개별 `left/top`, 개별 보정 scale을 만들지 않는다.
- viewport resize 또는 `ScrollTrigger.refresh()` 때만 cover 값을 다시 계산한다.
- 한 번의 스크롤 시퀀스 중 cover 값은 진행률에 따라 바뀌지 않는다.
- 광원 위치는 알려진 B 제품 픽셀 박스를 같은 cover 행렬로 변환해 계산한다.

## 스크롤 시퀀스

### 1. 히어로 유지

- 첫 히어로가 헤더 아래 viewport를 완전히 채운다.
- 히어로 내부 연출이 끝나기 전에 두 번째 섹션이 올라오지 않는다.

### 2. 두 번째 섹션 덮기

- 진단 장면이 아래에서 위로 올라와 히어로를 물리적으로 덮는다.
- 첫 히어로를 opacity로 지우지 않는다.

### 3. 진단 장면

- 진단 사진과 첫 설명을 충분히 보여 준다.

### 4. 합성 장면 진입

- A, B, light plane이 동일한 `yPercent: 100 → 0` 이동으로 함께 진입한다.
- A가 불투명하므로 이 구간에서는 사용자가 A의 합성 장면만 본다.
- 진입 이후 B의 transform은 변경하지 않는다.

### 5. 프레임 축소

- A만 `inset(0)`에서 둥근 카드 inset으로 변한다.
- 카드 밖에서 B의 온전한 임플란트가 드러난다.
- A에 구워진 임플란트와 B가 동일 픽셀·동일 좌표이므로 경계에서 하나처럼 이어져야 한다.
- B와 light plane에는 opacity 또는 scale tween을 만들지 않는다.
- `자연치아에 가까운 회복` 문구는 이 구간에서 숨기지 않고 그대로 유지한다.

### 6. 축소 상태 유지

- 카드 형태를 읽을 수 있는 짧은 scroll 구간을 둔다.

### 7. 프레임 퇴장

- 축소가 끝난 A의 reveal frame만 `translateY`로 위로 이동한다.
- reveal 내부 content wrapper에는 같은 거리의 역방향 `translateY`를 동시에 적용한다.
- 따라서 프레임 경계만 올라가며, 프레임 안 A의 임플란트 픽셀은 B와 동일한 viewport 좌표를 유지한다.
- A에 포함된 배경과 지지대는 올라가는 프레임 경계에 의해 함께 가려진다.
- B와 light plane은 고정된다.
- `자연치아에 가까운 회복` 문구는 frame exit 시작과 동시에 사라지지 않는다. 올라가는 카드의 하단 경계가 문구 영역을 실제로 통과하는 시점에만 짧게 숨긴다.

### 8. 최종 장면

- A가 완전히 사라진 뒤 최종 문구를 표시한다.
- B의 제품 좌표와 크기는 프레임 축소 전과 동일하다.
- 크라운 상단과 픽스처 하단에 viewport 안전 여백이 남아야 한다.

## GSAP 규칙

- 하나의 scrubbed timeline과 명시적 label을 사용한다.
- 권장 label: `diagnosis`, `implant-scene`, `frame-shrink`, `frame-hold`, `frame-exit`, `final-copy`.
- 배경 프레임의 clip과 퇴장을 동시에 실행하지 않는다.
- B에는 제품 교체용 `autoAlpha`, `opacity`, `visibility` tween을 만들지 않는다.
- B에는 `scale`, `scaleX`, `scaleY` tween을 만들지 않는다.
- A와 B가 함께 진입할 때만 같은 부모 plane에 동일한 이동값을 적용한다.
- `frame-exit`에서는 A reveal과 A content wrapper에 크기가 같고 부호가 반대인 이동값을 적용해 A/B 제품 픽셀이 갈라지지 않게 한다.
- `invalidateOnRefresh: true`를 사용한다.
- 빠른 스크롤과 역방향 스크롤에서도 같은 순서로 복원되어야 한다.

## 광원

- 광원과 입자는 B보다 아래, 흰 페이지보다 위의 sticky 형제 레이어다.
- 넓고 낮은 대비의 그라디언트를 사용한다.
- 그라디언트와 입자의 중심은 크라운이 아니라 픽스처 하단·뿌리 주변에 둔다.
- 제품 아래에 단단하고 어두운 타원형 그림자를 두지 않는다.
- 입자는 작은 반경과 낮은 alpha를 사용하며 화면 밖에서는 정지한다.
- A가 전체 화면일 때는 A가 광원을 가리고, A가 축소되면서 광원이 함께 드러난다.

## 반응형과 fallback

- desktop `>64rem`: pinned scroll sequence를 사용한다.
- compact와 medium `≤64rem`: pin과 scrub을 제거하고 자연 문서 흐름을 사용한다.
- desktop이라도 pin 최소 높이를 충족하지 못하면 같은 fallback을 사용한다.
- `prefers-reduced-motion: reduce`에서도 자연 흐름 fallback을 제공한다.
- viewport 높이에는 `svh`만 사용한다.

## 금지 사항

- 배경, 지지대, 장면 속 임플란트를 각각 DOM 레이어로 다시 분리하기
- A와 다른 소스 또는 다른 여백을 가진 임플란트를 B로 사용하기
- A와 B를 opacity crossfade로 교체하기
- A와 B에 서로 다른 cover 행렬 적용하기
- B를 타이트하게 crop한 뒤 수동 `left/top`으로 다시 맞추기
- 프레임 축소 중 B의 scale 또는 위치 변경하기
- 프레임 축소와 프레임 퇴장을 동시에 실행하기
- A가 남아 있는데 최종 문구를 표시하기
- 지지대를 독립적으로 움직이거나 opacity 처리하기
- 제품 아래에 경계가 뚜렷한 검은 타원 그림자 사용하기

## 픽셀 검수

다음 milestone에서 B stage와 제품 픽셀 박스의 변환값을 기록한다.

1. 합성 장면 진입 완료
2. A 축소 50%
3. A 축소 완료
4. A 퇴장 50%
5. A 완전 퇴장
6. 최종 문구 표시 완료

모든 milestone에서 다음을 만족해야 한다.

- B stage의 `x`, `y`, `width`, `height` 차이는 각각 1 CSS px 이내다.
- B의 computed transform scale 성분은 동일하다.
- B의 computed opacity는 `1`이다.
- A와 B의 공통 stage 행렬은 프레임 축소 시작 직전까지 일치한다.
- A의 clip 경계에서 이중 윤곽이나 위치 점프가 보이지 않는다.
- 크라운과 픽스처 끝이 viewport 안에 있다.
- 최종 문구가 보일 때 A의 `bottom <= 0`이다.

## 필수 viewport 검사

- 1920 × 대표 데스크톱 높이
- 1440 × 대표 데스크톱 높이
- 1288 × 747
- 1024, 768, 390 CSS px fallback
- pin 최소 높이 `-1px`, 정확한 값, `+1px`
- 200% text resize
- 400% browser zoom

## 완료 조건

- [ ] A는 배경·임플란트·지지대가 합쳐진 단일 이미지다.
- [ ] B는 A와 동일 캔버스·동일 임플란트 픽셀을 사용한다.
- [ ] 지지대 DOM 레이어가 없다.
- [ ] A와 B가 같은 cover 행렬을 공유한다.
- [ ] B에 opacity 또는 scale tween이 없다.
- [ ] A만 축소되고 A만 퇴장한다.
- [ ] A 완전 퇴장 뒤 최종 문구가 나타난다.
- [ ] 크라운과 픽스처 끝이 잘리지 않는다.
- [ ] compact, medium, reduced-motion fallback이 동작한다.
- [ ] 페이지 전체 수평 overflow와 콘솔 오류가 없다.
