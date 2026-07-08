/**
 * ============================================================================
 *  CUT GAME - Filtro de corte por timing para TikTok Effect House (APJS)
 * ============================================================================
 *
 *  Esta versão usa SOMENTE a API que já funcionava no seu script original,
 *  mais logs de diagnóstico no Console para descobrir onde trava.
 *
 *  >>> COMO COLOCAR PRA FUNCIONAR (leia isto!) <<<
 *   1) Este script precisa estar ANEXADO como componente a um objeto ATIVO
 *      (ex.: um Empty Object chamado "GameController"). Se o objeto estiver
 *      desabilitado, o onStart NEM roda.
 *   2) Tenha só UM script de jogo no projeto (remova versões antigas como
 *      CutGameFixed) para não conflitar. Nomes de classe repetidos quebram.
 *   3) No Inspector, arraste os objetos nos campos: knife, targetZone, food,
 *      foodHalfLeft, foodHalfRight, statusText, scoreText, comboText.
 *   4) Abra o painel de Console/Log da Effect House. Você DEVE ver a linha
 *      "[CutGame] onStart". Se não vê, é anexação/objeto desabilitado ou erro
 *      de compilação (veja o painel de erros).
 *
 *  API APJS verificada:
 *   - Gestos: getGestureEmitter().on(GestureType.Tap, cb, this) / .off(...).
 *   - Componentes por NOME: getComponent("ScreenTransform"), getComponent("Text").
 *   - Visibilidade: setEnabledInHierarchy(bool) (SceneObject NÃO tem .enabled).
 *   - 2D move por ScreenTransform.anchoredPosition (px) e sizeDelta (Vector2f).
 * ============================================================================
 */

@component()
export class CutGame extends APJS.BasicScriptComponent {
  // -------------------------------------------------------------------------
  //  REFERÊNCIAS DA CENA
  // -------------------------------------------------------------------------
  @serializeProperty()
  knife: APJS.SceneObject;

  @serializeProperty()
  targetZone: APJS.SceneObject;

  @serializeProperty()
  food: APJS.SceneObject;

  @serializeProperty()
  foodHalfLeft: APJS.SceneObject;

  @serializeProperty()
  foodHalfRight: APJS.SceneObject;

  @serializeProperty()
  statusText: APJS.SceneObject;

  @serializeProperty()
  scoreText: APJS.SceneObject;

  @serializeProperty()
  comboText: APJS.SceneObject;

  // -------------------------------------------------------------------------
  //  AJUSTES DE JOGO
  // -------------------------------------------------------------------------
  @serializeProperty()
  startSpeed: number = 0.55;

  @serializeProperty()
  speedIncrement: number = 0.06;

  @serializeProperty()
  maxSpeed: number = 2.2;

  /** Largura TOTAL do trajeto da faca (px). A faca oscila metade para cada lado. */
  @serializeProperty()
  travelDistance: number = 240;

  @serializeProperty()
  perfectTolerance: number = 0.05;

  @serializeProperty()
  goodTolerance: number = 0.13;

  @serializeProperty()
  resolveDuration: number = 0.6;

  /** Distância (px) que cada metade "voa" ao ser cortada. */
  @serializeProperty()
  splitDistance: number = 160;

  /** Quantos cortes tem uma partida. */
  @serializeProperty()
  cutsPerGame: number = 5;

  /** Vidas (erros permitidos) por partida. */
  @serializeProperty()
  lives: number = 3;

  // -------------------------------------------------------------------------
  //  ESTADO
  // -------------------------------------------------------------------------
  private readonly STATE_PLAY: number = 0;
  private readonly STATE_RESOLVE: number = 1;
  private readonly STATE_OVER: number = 2;

  /**
   * Altura (px) da zona-alvo verde. Alta porque a tesoura fica EM PÉ (vertical).
   * Ajuste este número para casar com a altura da sua imagem de tesoura.
   * Constante privada de propósito: não é serializada, então não afeta as
   * ligações de objetos já feitas no Inspector.
   */
  private readonly TARGET_ZONE_HEIGHT: number = 320;

  private state: number = 0;
  private initialized: boolean = false;
  private warnedMissing: boolean = false;

  private speed: number = 0.55;
  private phase: number = 0;
  private currentT: number = 0;
  private targetT: number = 0.5;

  private score: number = 0;
  private best: number = 0;
  private combo: number = 0;
  private livesLeft: number = 3;
  private roundsPlayed: number = 0;
  private hits: number = 0;
  private perfects: number = 0;

  private resolveTimer: number = 0;

  // Posições/tamanhos base (lidos na inicialização)
  private knifeX: number = 0; private knifeY: number = 0;
  private foodX: number = 0; private foodY: number = 0;
  private leftBaseX: number = 0; private leftBaseY: number = 0;
  private rightBaseX: number = 0; private rightBaseY: number = 0;
  private leftW: number = 0; private leftH: number = 0;
  private rightW: number = 0; private rightH: number = 0;
  private targetH: number = 0;

  // Destinos da animação de corte
  private lToX: number = 0; private lToY: number = 0;
  private rToX: number = 0; private rToY: number = 0;

  private tapCallback!: (event: APJS.IEvent) => void;

  // ==========================================================================
  //  CICLO DE VIDA
  // ==========================================================================
  onStart(): void {
    console.log("[CutGame] onStart | knife=" + (!!this.knife) +
      " targetZone=" + (!!this.targetZone) +
      " food=" + (!!this.food) +
      " statusText=" + (!!this.statusText));
    this.subscribeTap();
  }

  onUpdate(deltaTime: number): void {
    // Inicialização preguiçosa: espera as referências estarem disponíveis.
    if (!this.initialized) {
      if (!this.knife || !this.food || !this.statusText) {
        if (!this.warnedMissing) {
          console.log("[CutGame] AGUARDANDO: ligue knife, food e statusText no Inspector.");
          this.warnedMissing = true;
        }
        return;
      }
      this.initializeGame();
      this.initialized = true;
      console.log("[CutGame] inicializado | knifeX=" + this.knifeX + " knifeY=" + this.knifeY);
    }

    if (this.state === this.STATE_RESOLVE) {
      this.updateResolve(deltaTime);
      return;
    }

    if (this.state === this.STATE_PLAY) {
      this.phase += this.speed * deltaTime;
      this.currentT = this.triangle(this.phase);
      this.setPos(this.knife, this.trackX(this.currentT), this.knifeY);
    }
    // STATE_OVER: a faca para; aguardando toque para reiniciar.
  }

  onDestroy(): void {
    if (!this.tapCallback) return;
    APJS.EventManager.getGestureEmitter().off(APJS.GestureType.Tap, this.tapCallback, this);
  }

  // ==========================================================================
  //  TOQUE
  // ==========================================================================
  private subscribeTap(): void {
    this.tapCallback = (_event: APJS.IEvent) => {
      console.log("[CutGame] Tap recebido | state=" + this.state);
      this.onTap();
    };
    APJS.EventManager.getGestureEmitter().on(APJS.GestureType.Tap, this.tapCallback, this);
    console.log("[CutGame] Tap registrado");
  }

  private onTap(): void {
    if (!this.initialized) return;

    // Fim de jogo: toque reinicia.
    if (this.state === this.STATE_OVER) {
      this.resetGame();
      return;
    }
    if (this.state !== this.STATE_PLAY) return;

    const diff = Math.abs(this.currentT - this.targetT);

    if (diff <= this.perfectTolerance) {
      this.perfects += 1;
      this.registerCut(3, "CORTE PERFEITO!");
    } else if (diff <= this.goodTolerance) {
      this.registerCut(1, "BOM CORTE!");
    } else {
      this.combo = 0;
      this.livesLeft -= 1;
      this.roundsPlayed += 1;
      this.updateComboText();
      this.setText(this.statusText, "ERROU!   Vidas: " + Math.max(0, this.livesLeft));
      this.startResolve(false);
    }
  }

  private registerCut(points: number, label: string): void {
    this.combo += 1;
    this.hits += 1;
    const gained = points * (1 + Math.floor(this.combo / 3));
    this.score += gained;
    if (this.score > this.best) this.best = this.score;

    this.speed = Math.min(this.maxSpeed, this.speed + this.speedIncrement);
    this.roundsPlayed += 1;

    this.setText(this.statusText, label + "   +" + gained);
    this.updateScoreText();
    this.updateComboText();
    this.startResolve(true);
  }

  // ==========================================================================
  //  FLUXO DE PARTIDA
  // ==========================================================================
  private initializeGame(): void {
    const k = this.getPos(this.knife); this.knifeX = k.x; this.knifeY = k.y;
    const f = this.getPos(this.food); this.foodX = f.x; this.foodY = f.y;
    if (this.targetZone) {
      this.targetH = this.getSize(this.targetZone).y;
    }

    if (this.foodHalfLeft) {
      const p = this.getPos(this.foodHalfLeft); this.leftBaseX = p.x; this.leftBaseY = p.y;
      const s = this.getSize(this.foodHalfLeft); this.leftW = s.x; this.leftH = s.y;
    }
    if (this.foodHalfRight) {
      const p = this.getPos(this.foodHalfRight); this.rightBaseX = p.x; this.rightBaseY = p.y;
      const s = this.getSize(this.foodHalfRight); this.rightW = s.x; this.rightH = s.y;
    }

    this.resetGame();
  }

  private resetGame(): void {
    this.score = 0;
    this.combo = 0;
    this.livesLeft = this.lives;
    this.roundsPlayed = 0;
    this.hits = 0;
    this.perfects = 0;
    this.speed = this.startSpeed;
    this.updateScoreText();
    this.updateComboText();
    this.newRound();
  }

  private newRound(): void {
    this.targetT = 0.18 + Math.random() * 0.64;

    if (this.targetZone) {
      // Barra VERTICAL: largura = janela do "bom corte"; altura = alta,
      // para casar com a lâmina em pé (tesoura vertical).
      this.setEnabled(this.targetZone, true);
      this.setPos(this.targetZone, this.trackX(this.targetT), this.knifeY);
      const goodWidthPx = this.goodTolerance * 2 * this.travelDistance;
      this.setSize(this.targetZone, goodWidthPx, this.TARGET_ZONE_HEIGHT);
    }

    if (this.food) {
      this.setEnabled(this.food, true);
      this.setPos(this.food, this.foodX, this.foodY);
    }
    this.setEnabled(this.foodHalfLeft, false);
    this.setEnabled(this.foodHalfRight, false);

    // Começa numa fase aleatória e JÁ atualiza a posição da faca / currentT,
    // para que um toque imediato seja avaliado corretamente.
    this.phase = Math.random();
    this.currentT = this.triangle(this.phase);
    this.setPos(this.knife, this.trackX(this.currentT), this.knifeY);

    this.state = this.STATE_PLAY;
    this.setText(this.statusText, "Toque para cortar!   (" + (this.roundsPlayed + 1) + "/" + this.cutsPerGame + ")");
  }

  private startResolve(success: boolean): void {
    this.state = this.STATE_RESOLVE;
    this.resolveTimer = 0;

    if (success && this.food && this.foodHalfLeft && this.foodHalfRight) {
      this.setEnabled(this.food, false);
      this.setEnabled(this.foodHalfLeft, true);
      this.setEnabled(this.foodHalfRight, true);

      // Metades começam nas SUAS posições originais (montadas) e voam pra fora.
      this.setPos(this.foodHalfLeft, this.leftBaseX, this.leftBaseY);
      this.setPos(this.foodHalfRight, this.rightBaseX, this.rightBaseY);

      this.lToX = this.leftBaseX - this.splitDistance;
      this.lToY = this.leftBaseY - this.splitDistance * 0.5;
      this.rToX = this.rightBaseX + this.splitDistance;
      this.rToY = this.rightBaseY - this.splitDistance * 0.5;
    }
  }

  private updateResolve(deltaTime: number): void {
    this.resolveTimer += deltaTime;
    const t = Math.min(1, this.resolveTimer / this.resolveDuration);
    const ease = this.easeOutCubic(t);

    if (this.foodHalfLeft && this.isEnabled(this.foodHalfLeft)) {
      this.setPos(this.foodHalfLeft, this.lerp(this.leftBaseX, this.lToX, ease), this.lerp(this.leftBaseY, this.lToY, ease));
      this.setSize(this.foodHalfLeft, this.leftW * (1 - ease), this.leftH * (1 - ease));
    }
    if (this.foodHalfRight && this.isEnabled(this.foodHalfRight)) {
      this.setPos(this.foodHalfRight, this.lerp(this.rightBaseX, this.rToX, ease), this.lerp(this.rightBaseY, this.rToY, ease));
      this.setSize(this.foodHalfRight, this.rightW * (1 - ease), this.rightH * (1 - ease));
    }

    if (t >= 1) {
      // Restaura o tamanho das metades para a próxima vez.
      if (this.foodHalfLeft) this.setSize(this.foodHalfLeft, this.leftW, this.leftH);
      if (this.foodHalfRight) this.setSize(this.foodHalfRight, this.rightW, this.rightH);

      if (this.livesLeft <= 0 || this.roundsPlayed >= this.cutsPerGame) {
        this.gameOver();
      } else {
        this.newRound();
      }
    }
  }

  private gameOver(): void {
    this.state = this.STATE_OVER;
    this.setEnabled(this.food, false);
    this.setEnabled(this.foodHalfLeft, false);
    this.setEnabled(this.foodHalfRight, false);
    if (this.targetZone) this.setEnabled(this.targetZone, false);
    this.setText(this.statusText, this.getRank() + "\nPontos: " + this.score + "   |   Toque para jogar de novo");
  }

  private getRank(): string {
    if (this.hits <= 0) return "Desastre na cozinha";
    if (this.perfects >= this.cutsPerGame) return "MESTRE DO CORTE!";
    if (this.hits >= Math.ceil(this.cutsPerGame * 0.6)) return "Cozinheiro promissor";
    return "Aprendiz de cozinha";
  }

  // ==========================================================================
  //  MATEMÁTICA
  // ==========================================================================
  private triangle(phase: number): number {
    const p = phase - Math.floor(phase);
    return p < 0.5 ? p * 2 : 2 - p * 2;
  }

  private easeOutCubic(t: number): number {
    const u = 1 - t;
    return 1 - u * u * u;
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /** Converte t (0..1) na posição X ao longo do trajeto, centrado na faca. */
  private trackX(t: number): number {
    return this.knifeX + this.travelDistance * (t - 0.5);
  }

  // ==========================================================================
  //  HELPERS 2D — ScreenTransform via getComponent("...") COM fallback 3D
  // ==========================================================================
  private getScreenTransform(obj: APJS.SceneObject): APJS.ScreenTransform | null {
    if (!obj) return null;
    return obj.getComponent("ScreenTransform") as APJS.ScreenTransform;
  }

  private getPos(obj: APJS.SceneObject): { x: number; y: number } {
    if (!obj) return { x: 0, y: 0 };
    const st = this.getScreenTransform(obj);
    if (st) {
      const p = st.anchoredPosition;
      return { x: p.x, y: p.y };
    }
    const p = obj.transform.localPosition;
    return { x: p.x, y: p.y };
  }

  private setPos(obj: APJS.SceneObject, x: number, y: number): void {
    if (!obj) return;
    const st = this.getScreenTransform(obj);
    if (st) {
      st.anchoredPosition = new APJS.Vector2f(x, y);
      return;
    }
    const z = obj.transform.localPosition.z;
    obj.transform.localPosition = new APJS.Vector3f(x, y, z);
  }

  private getSize(obj: APJS.SceneObject): { x: number; y: number } {
    if (!obj) return { x: 0, y: 0 };
    const st = this.getScreenTransform(obj);
    if (st && st.sizeDelta) return { x: st.sizeDelta.x, y: st.sizeDelta.y };
    return { x: 0, y: 0 };
  }

  private setSize(obj: APJS.SceneObject, w: number, h: number): void {
    if (!obj) return;
    const st = this.getScreenTransform(obj);
    if (st) {
      st.sizeDelta = new APJS.Vector2f(Math.max(0, w), Math.max(0, h));
      return;
    }
    const base = this.leftW > 0 ? this.leftW : 1;
    const f = Math.max(0, w / base);
    obj.transform.localScale = new APJS.Vector3f(f, f, f);
  }

  private setEnabled(obj: APJS.SceneObject, on: boolean): void {
    if (obj) obj.setEnabledInHierarchy(on);
  }

  private isEnabled(obj: APJS.SceneObject): boolean {
    return obj ? obj.isEnabledInHierarchy() : false;
  }

  // ==========================================================================
  //  TEXTO / HUD  — getComponent("Text")
  // ==========================================================================
  private setText(obj: APJS.SceneObject, value: string): void {
    if (!obj) return;
    const txt = obj.getComponent("Text") as APJS.Text;
    if (txt) txt.text = value;
  }

  private updateScoreText(): void {
    this.setText(this.scoreText, "Pontos: " + this.score + "   Recorde: " + this.best);
  }

  private updateComboText(): void {
    if (!this.comboText) return;
    this.setText(this.comboText, this.combo > 1 ? "Sequencia: " + this.combo : "");
  }
}
