import classnames from 'classnames'
import type { PropsWithChildren, ReactElement } from 'react';
import { useCallback, useState } from 'react'
import { OperateMode } from 'Latte/core/cursor'
import { unknownType } from 'Latte/common/error'
import DefaultCursor from 'Latte/assets/static/editor-cursor.svg'
import Shape from 'Latte/assets/static/shape.svg'
import Pointer from 'Latte/assets/static/pointer.svg'
import 'Latte/workbench/toolbar/toolbar.css'


interface IToolbarViewProps {
  active: boolean
  onClick:() => void
}

const getSVGComponentByType = (type:OperateMode) => {
  let svg:null | ReactElement = null
  switch(type){
    case  OperateMode.CreateNormalShape:
      svg = <Shape/>
      break;
    case OperateMode.Edit:
      svg = <DefaultCursor/>
      break;
    case OperateMode.ReadOnly:
      svg = <Pointer/>
      break;
    default:
      unknownType(type)
      break;
  }
  return svg
}

const ToolbarView = (props:PropsWithChildren<IToolbarViewProps>) => {
  const { active, onClick, children } = props
  return <div
  className={classnames('toolbar_view', { 'toolbar_view--active': active })}
  onClick={onClick}
  >
    <span className='toolbar_view__svg-container'>
       { children }
    </span>
  </div>
}

const views = [
      { type: OperateMode.Edit },
      { type: OperateMode.CreateNormalShape },
      { type: OperateMode.ReadOnly },
    ]

export const ToolBarPart=(props)=>
  {
    const [activeType, setActiveType] = useState(OperateMode.Edit)

    const handleSwitchType = useCallback((type: OperateMode) => {
      setActiveType(type)
      latte.editor.setOperateMode(type)
    }, [])

    return <div className="toolbar toolbar-container">
      {
        views.map(item => <ToolbarView 
          active={item.type === activeType}
          onClick={handleSwitchType.bind(null,item.type)}
        >
          {getSVGComponentByType(item.type)}
        </ToolbarView>)
      }
    </div>
  }