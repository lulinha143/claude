@component()
export class CutGameAuto extends APJS.BasicScriptComponent {
  @serializeProperty() @label("Velocidade")
  speed: number = 0.65;

  @serializeProperty() @label("Rodadas Antes de Acelerar")
  roundsBeforeSpeedUp: number = 3;

  @serializeProperty() @label("Incremento de Velocidade / Rodada")
  speedIncrement: number = 0.08;

  @serializeProperty() @label("Velocidade Máxima")
  maxSpeed: number = 2.4;

  @serializeProperty() @label("Distância do Percurso")
  travelDistance: number = 600;

  @serializeProperty() @label("Tolerância Perfeita")
  perfectTolerance: number = 0.04;

  @serializeProperty() @label("Tolerância Boa")
  goodTolerance: number = 0.13;

  @serializeProperty() @label("Altura da Zona-Alvo")
  targetZoneHeight: number = 320;

  @serializeProperty() @label("Vidas")
  startingLives: number = 3;

  @serializeProperty() @label("Duração do Resultado")
  resolveDuration: number = 0.65;

  @serializeProperty() @label("Tamanho do Texto Principal")
  statusFontSize: number = 60;

  @serializeProperty() @label("Tamanho do Texto de Pontos")
  scoreFontSize: number = 38;

  @serializeProperty() @label("Tamanho do Texto de Combo")
  comboFontSize: number = 44;

  private readonly PLAYING: number = 0;
  private readonly RESOLVING: number = 1;
  private readonly GAME_OVER: number = 2;

  private knife: APJS.SceneObject | null = null;
  private targetZone: APJS.SceneObject | null = null;
  private food: APJS.SceneObject | null = null;
  private foodHalfLeft: APJS.SceneObject | null = null;
  private foodHalfRight: APJS.SceneObject | null = null;
  private statusText: APJS.SceneObject | null = null;
  private scoreText: APJS.SceneObject | null = null;
  private comboText: APJS.SceneObject | null = null;

  private knifeTransform: APJS.ScreenTransform | null = null;
  private targetTransform: APJS.ScreenTransform | null = null;

  private initialized: boolean = false;
  private warned: boolean = false;
  private state: number = 0;
  private phase: number = 0;
  private knifeT: number = 0;
  private targetT: number = 0.5;
  private startX: number = 0;
  private startY: number = 0;
  private score: number = 0;
  private combo: number = 0;
  private lives: number = 3;
  private rounds: number = 0;
  private timer: number = 0;
  private tapCallback: any = null;

  onStart(): void {
    console.log("[CutGameAuto] onStart");

    this.tapCallback = (_event: APJS.IEvent) => {
      console.log("[CutGameAuto] Toque");
      this.onTap();
    };

    APJS.EventManager.getGestureEmitter().on(
      APJS.GestureType.Tap,
      this.tapCallback,
      this
    );

    console.log("[CutGameAuto] Toque registrado");
  }

  onUpdate(deltaTime: number): void {
    if (!this.initialized) {
      this.initialize();

      if (!this.initialized) {
        return;
      }
    }

    if (this.state === this.PLAYING) {
      // A velocidade sobe conforme o nível avança (ver getCurrentSpeed()).
      this.phase += Math.max(0.01, this.getCurrentSpeed()) * deltaTime;
      this.knifeT = this.triangle(this.phase);

      this.knifeTransform!.anchoredPosition = new APJS.Vector2f(
        this.trackX(this.knifeT),
        this.startY
      );

      return;
    }

    if (this.state === this.RESOLVING) {
      this.timer += deltaTime;

      if (this.timer >= Math.max(0.05, this.resolveDuration)) {
        if (this.lives <= 0) {
          this.finishGame();
        } else {
          this.newRound();
        }
      }
    }
  }

  onDestroy(): void {
    if (!this.tapCallback) {
      return;
    }

    APJS.EventManager.getGestureEmitter().off(
      APJS.GestureType.Tap,
      this.tapCallback,
      this
    );
  }

  private initialize(): void {
    const scene = this.getSceneObject().scene;

    this.knife = scene.findSceneObject("Knife") || null;
    this.targetZone = scene.findSceneObject("TargetZone") || null;
    this.food = scene.findSceneObject("Food") || null;
    this.foodHalfLeft = scene.findSceneObject("FoodHalfLeft") || null;
    this.foodHalfRight = scene.findSceneObject("FoodHalfRight") || null;
    this.statusText = scene.findSceneObject("StatusText") || null;
    this.scoreText = scene.findSceneObject("ScoreText") || null;
    this.comboText = scene.findSceneObject("ComboText") || null;

    if (!this.knife || !this.targetZone) {
      if (!this.warned) {
        console.log(
          "[CutGameAuto] Não encontrou Knife ou TargetZone pelo nome."
        );

        this.warned = true;
      }

      return;
    }

    this.knifeTransform = this.knife.getComponent(
      "ScreenTransform"
    ) as APJS.ScreenTransform;

    this.targetTransform = this.targetZone.getComponent(
      "ScreenTransform"
    ) as APJS.ScreenTransform;

    if (!this.knifeTransform || !this.targetTransform) {
      if (!this.warned) {
        console.log(
          "[CutGameAuto] Knife e TargetZone precisam de ScreenTransform."
        );

        this.warned = true;
      }

      return;
    }

    const position = this.knifeTransform.anchoredPosition;

    this.startX = position.x;
    this.startY = position.y;
    this.initialized = true;
    this.warned = false;

    this.applyTextStyles();

    console.log("[CutGameAuto] inicializado");

    this.resetGame();
  }

  private resetGame(): void {
    this.score = 0;
    this.combo = 0;
    this.lives = Math.max(1, Math.floor(this.startingLives));
    this.rounds = 0;
    this.phase = Math.random();

    this.setTextColor(this.statusText, this.whiteColor());
    this.updateHud();
    this.newRound();
  }

  private newRound(): void {
    this.state = this.PLAYING;
    this.timer = 0;
    this.targetT = 0.18 + Math.random() * 0.64;

    this.setEnabled(this.targetZone, true);
    this.setEnabled(this.food, true);
    this.setEnabled(this.foodHalfLeft, false);
    this.setEnabled(this.foodHalfRight, false);

    this.targetTransform!.anchoredPosition = new APJS.Vector2f(
      this.trackX(this.targetT),
      this.startY
    );

    const width =
      Math.max(0.001, this.goodTolerance) *
      2 *
      Math.max(1, Math.abs(this.travelDistance));

    this.targetTransform!.sizeDelta = new APJS.Vector2f(
      width,
      Math.max(1, this.targetZoneHeight)
    );

    this.setStatusText(
      "TOQUE PARA CORTAR!\nCORTE " + (this.rounds + 1),
      false
    );
  }

  private onTap(): void {
    if (!this.initialized) {
      this.initialize();
      return;
    }

    if (this.state === this.GAME_OVER) {
      this.resetGame();
      return;
    }

    if (this.state !== this.PLAYING) {
      return;
    }

    const difference = Math.abs(this.knifeT - this.targetT);
    const perfect = Math.max(0, this.perfectTolerance);
    const good = Math.max(perfect, this.goodTolerance);

    this.rounds += 1;

    if (difference <= perfect) {
      this.combo += 1;
      this.score += 100 + Math.max(0, this.combo - 1) * 10;

      this.setStatusText("CORTE PERFEITO!", false);
      this.showCutFood();
    } else if (difference <= good) {
      this.combo += 1;
      this.score += 50 + Math.max(0, this.combo - 1) * 5;

      this.setStatusText("BOM CORTE!", false);
      this.showCutFood();
    } else {
      this.combo = 0;
      this.lives -= 1;

      this.setStatusText(
        "ERROU!\nVIDAS: " + Math.max(0, this.lives),
        false
      );
    }

    this.updateHud();
    this.setEnabled(this.targetZone, false);

    this.state = this.RESOLVING;
    this.timer = 0;
  }

  /**
   * Velocidade atual da faca.
   * Até "roundsBeforeSpeedUp" cortes, mantém a velocidade base. A partir daí,
   * cada rodada soma "speedIncrement", limitado por "maxSpeed" — assim o jogo
   * vai ficando mais difícil conforme você avança.
   */
  private getCurrentSpeed(): number {
    const threshold = Math.max(0, Math.floor(this.roundsBeforeSpeedUp));
    const level = this.rounds - threshold;

    if (level <= 0) {
      return this.speed;
    }

    const ramped = this.speed + level * Math.max(0, this.speedIncrement);
    const ceiling = Math.max(this.speed, this.maxSpeed);

    return Math.min(ceiling, ramped);
  }

  private showCutFood(): void {
    if (!this.foodHalfLeft || !this.foodHalfRight) {
      return;
    }

    this.setEnabled(this.food, false);
    this.setEnabled(this.foodHalfLeft, true);
    this.setEnabled(this.foodHalfRight, true);
  }

  private finishGame(): void {
    this.state = this.GAME_OVER;

    this.setEnabled(this.targetZone, false);

    this.setStatusText(
      "FIM DE JOGO!\nTOQUE PARA JOGAR DE NOVO",
      true
    );
  }

  private updateHud(): void {
    this.setText(
      this.scoreText,
      "PONTOS: " + this.score + "   VIDAS: " + Math.max(0, this.lives)
    );

    this.setText(
      this.comboText,
      this.combo > 1 ? "COMBO x" + this.combo : ""
    );

    this.setTextColor(this.scoreText, this.whiteColor());
    this.setTextColor(this.comboText, this.whiteColor());
  }

  private applyTextStyles(): void {
    this.styleText(
      this.statusText,
      this.statusFontSize
    );

    this.styleText(
      this.scoreText,
      this.scoreFontSize
    );

    this.styleText(
      this.comboText,
      this.comboFontSize
    );
  }

  private styleText(
    object: APJS.SceneObject | null,
    fontSize: number
  ): void {
    if (!object) {
      return;
    }

    const text = object.getComponent("Text") as APJS.Text;

    if (!text) {
      return;
    }

    text.fontSize = Math.max(1, fontSize);
    text.bold = true;
    text.italic = false;
    text.letterSpacing = 0;
    text.lineSpacing = 0;
    text.opacity = 1;
    text.color = this.whiteColor();

    const black = this.blackColor();

    if (text.getOutlineCount() > 0) {
      text.setOutlineColorAtIndex(0, black);
    }

    if (text.getShadowCount() > 0) {
      text.setShadowColorAtIndex(
        0,
        new APJS.Color(0, 0, 0, 0.85)
      );
    }
  }

  private setStatusText(
    value: string,
    defeat: boolean
  ): void {
    this.setText(this.statusText, value);

    this.setTextColor(
      this.statusText,
      defeat
        ? new APJS.Color(1.0, 0.08, 0.08, 1.0)
        : this.whiteColor()
    );
  }

  private setTextColor(
    object: APJS.SceneObject | null,
    color: APJS.Color
  ): void {
    if (!object) {
      return;
    }

    const text = object.getComponent("Text") as APJS.Text;

    if (text) {
      text.color = color;
    }
  }

  private whiteColor(): APJS.Color {
    return new APJS.Color(1, 1, 1, 1);
  }

  private blackColor(): APJS.Color {
    return new APJS.Color(0, 0, 0, 1);
  }

  private triangle(value: number): number {
    const normalized = value - Math.floor(value);

    return normalized < 0.5
      ? normalized * 2
      : 2 - normalized * 2;
  }

  private trackX(value: number): number {
    return (
      this.startX +
      Math.abs(this.travelDistance) * (value - 0.5)
    );
  }

  private setEnabled(
    object: APJS.SceneObject | null,
    enabled: boolean
  ): void {
    if (!object) {
      return;
    }

    object.setEnabledInHierarchy(enabled);
  }

  private setText(
    object: APJS.SceneObject | null,
    value: string
  ): void {
    if (!object) {
      return;
    }

    const text = object.getComponent("Text") as APJS.Text;

    if (text) {
      text.text = value;
    }
  }
}
