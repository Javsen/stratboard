import type { GlowFilterOptions } from 'pixi-filters'
import type { Application, FillInput } from 'pixi.js'

import { GlowFilter } from 'pixi-filters'
import { Container, Graphics, Point, Rectangle, Sprite, Texture } from 'pixi.js'

import { YmToPx } from './utils'

const COLORS = {
  aoe: '#e7a15d',
  innerShadow: '#e09142',
  outerGlow: '#f6c74f',
} as const

export type AoEColors = typeof COLORS

export interface AoECreateOptions {
  colors?: Partial<AoEColors>
  aoeAlpha?: number
  innerShadowOptions?: Partial<GlowFilterOptions>
  outerGlowOptions?: Partial<GlowFilterOptions>
}

export type AoEType = 'rect' | 'ray' | 'circle' | 'ring' | 'fan'

export class AoETexture extends Texture {
  type: AoEType

  constructor(texture: Texture, type: AoEType) {
    super(texture)
    this.type = type
  }

  getCenterPivot() {
    if (this.type === 'ray' || this.type === 'fan') {
      return new Point(YmToPx, this.height / 2)
    } else {
      return new Point(this.width / 2, this.height / 2)
    }
  }
}

export class AoE extends Container {
  type: AoEType

  constructor(
    type: AoEType,
    fn: (style?: FillInput) => Graphics,
    aoeStyle?: FillInput,
    innerShadowOptions: GlowFilterOptions = {},
    outerGlowOptions: GlowFilterOptions = {},
  ) {
    super()

    this.type = type

    const innerShadow = AoE.createInnerShadow(fn, innerShadowOptions)
    const outerGlow = AoE.createOuterGlow(fn, outerGlowOptions)
    const aoe = fn(aoeStyle)

    innerShadow.label = 'inner_shadow'
    outerGlow.label = 'outer_glow'
    aoe.label = 'aoe'

    this.addChild(innerShadow)
    this.addChild(outerGlow)
    this.addChild(aoe)
  }

  private getComputedRectangle() {
    const bounds = this.getLocalBounds()
    const rect = new Rectangle(
      bounds.x - YmToPx,
      bounds.y - YmToPx,
      bounds.width + YmToPx * 2,
      bounds.height + YmToPx * 2,
    )
    return rect
  }

  /**
   * 将当前AoE容器转换为纹理，以避免父容器添加遮罩时，出现光效残留bug
   */
  toTexture(app: Application) {
    const rectangle = this.getComputedRectangle()
    return new AoETexture(app.renderer.extract.texture({ target: this, frame: rectangle }), this.type)
  }

  /**
   * 将当前AoE容器转换为精灵，理由同上
   */
  toSprite(app: Application) {
    const texture = this.toTexture(app)
    const sprite = Sprite.from(texture)
    const centerPivot = texture.getCenterPivot()
    sprite.pivot.set(centerPivot.x, centerPivot.y)
    return sprite
  }

  /**
   * 创建矩形AoE效果
   */
  static createRect(width: number, height: number, options: AoECreateOptions = {}): AoE {
    const { colors = {}, aoeAlpha = 0.25, innerShadowOptions = {}, outerGlowOptions = {} } = options

    return new AoE(
      'rect',
      style => AoE.createRectGraphics(width, height, style),
      { color: colors.aoe ?? COLORS.aoe, alpha: aoeAlpha },
      { color: colors.innerShadow ?? COLORS.innerShadow, ...innerShadowOptions },
      { color: colors.outerGlow ?? COLORS.outerGlow, ...outerGlowOptions },
    )
  }

  /**
   * 创建射线AoE效果
   */
  static createRay(width: number, length: number, options: AoECreateOptions = {}): AoE {
    const { colors = {}, aoeAlpha = 0.25, innerShadowOptions = {}, outerGlowOptions = {} } = options

    return new AoE(
      'ray',
      style => AoE.createRectGraphics(length, width, style),
      { color: colors.aoe ?? COLORS.aoe, alpha: aoeAlpha },
      { color: colors.innerShadow ?? COLORS.innerShadow, ...innerShadowOptions },
      { color: colors.outerGlow ?? COLORS.outerGlow, ...outerGlowOptions },
    )
  }

  /**
   * 创建圆形AoE效果
   */
  static createCircle(radius: number, options: AoECreateOptions = {}): AoE {
    const { colors = {}, aoeAlpha = 0.25, innerShadowOptions = {}, outerGlowOptions = {} } = options

    return new AoE(
      'circle',
      style => AoE.createCircleGraphics(radius, style),
      { color: colors.aoe ?? COLORS.aoe, alpha: aoeAlpha },
      { color: colors.innerShadow ?? COLORS.innerShadow, ...innerShadowOptions },
      { color: colors.outerGlow ?? COLORS.outerGlow, ...outerGlowOptions },
    )
  }

  /**
   * 创建环形AoE效果
   */
  static createRing(innerRadius: number, outerRadius: number, options: AoECreateOptions = {}): AoE {
    if (innerRadius >= outerRadius) {
      throw new Error('内圆半径必须小于外圆半径')
    }

    const { colors = {}, aoeAlpha = 0.25, innerShadowOptions = {}, outerGlowOptions = {} } = options

    return new AoE(
      'ring',
      style => AoE.createRingGraphics(innerRadius, outerRadius, style),
      { color: colors.aoe ?? COLORS.aoe, alpha: aoeAlpha },
      { color: colors.innerShadow ?? COLORS.innerShadow, ...innerShadowOptions },
      { color: colors.outerGlow ?? COLORS.outerGlow, ...outerGlowOptions },
    )
  }

  /**
   * 创建扇形AoE效果
   */
  static createFan(radius: number, angle: number, options: AoECreateOptions = {}): AoE {
    const { colors = {}, aoeAlpha = 0.25, innerShadowOptions = {}, outerGlowOptions = {} } = options

    const aoe = new AoE(
      'fan',
      style => AoE.createFanGraphics(radius, angle, style),
      { color: colors.aoe ?? COLORS.aoe, alpha: aoeAlpha },
      { color: colors.innerShadow ?? COLORS.innerShadow, ...innerShadowOptions },
      { color: colors.outerGlow ?? COLORS.outerGlow, ...outerGlowOptions },
    )
    return aoe
  }

  private static createRectGraphics(width: number, height: number, style?: FillInput) {
    const rect = new Graphics()
    rect.rect((-width * YmToPx) / 2, (-height * YmToPx) / 2, width * YmToPx, height * YmToPx)
    rect.fill(style)
    return rect
  }

  private static createCircleGraphics(radius: number, style?: FillInput) {
    const circle = new Graphics()
    circle.circle(0, 0, radius * YmToPx)
    circle.fill(style)
    return circle
  }

  private static createRingGraphics(innerRadius: number, outerRadius: number, style?: FillInput) {
    const ring = new Graphics()
    ring.circle(0, 0, outerRadius * YmToPx)
    ring.fill(style)
    ring.circle(0, 0, innerRadius * YmToPx)
    ring.cut()
    return ring
  }

  private static createFanGraphics(radius: number, angle: number, style?: FillInput) {
    const fan = new Graphics()
    fan.arc(0, 0, radius * YmToPx, (-angle * Math.PI) / 360, (angle * Math.PI) / 360)
    fan.lineTo(0, 0)
    fan.closePath()
    fan.fill(style)
    return fan
  }

  private static createInnerShadow(fn: (style?: FillInput) => Graphics, options: GlowFilterOptions = {}) {
    const c = new Container()
    const g = fn({ color: 'white', alpha: 1 })
    c.addChild(g)
    c.filters = [
      new GlowFilter({
        color: options.color ?? COLORS.innerShadow,
        distance: options.distance ?? 32,
        innerStrength: options.innerStrength ?? 2,
        outerStrength: options.outerStrength ?? 0,
        quality: options.quality ?? 0.5,
        knockout: options.knockout ?? true,
      }),
    ]
    c.alpha = options.alpha ?? 1
    return c
  }

  private static createOuterGlow(fn: (style?: FillInput) => Graphics, options: GlowFilterOptions = {}) {
    const c = new Container()
    const g = fn({ color: 'white', alpha: 1 })
    c.addChild(g)
    c.filters = [
      new GlowFilter({
        color: options.color ?? COLORS.outerGlow,
        distance: options.distance ?? 8,
        innerStrength: options.innerStrength ?? 0,
        outerStrength: options.outerStrength ?? 8,
        quality: options.quality ?? 0.5,
        knockout: options.knockout ?? false,
      }),
    ]
    const mask = fn({ color: 'white', alpha: 1 })
    c.setMask({ mask, inverse: true })
    c.addChild(mask)
    c.alpha = options.alpha ?? 0.4
    return c
  }
}
