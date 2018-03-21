/**
 * @fileOverview Render a group of bar
 */
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import _ from 'lodash';
import Cell from '../component/Cell';
import pureRender from '../util/PureRender';
import { uniqueId, mathSign } from '../util/DataUtils';
import { PRESENTATION_ATTRIBUTES, EVENT_ATTRIBUTES, LEGEND_TYPES,
  findAllByType, getPresentationAttributes, filterEventsOfChild, isSsr,
  filterEventAttributes, getRectangePath } from '../util/ReactUtils';
import { getCateCoordinateOfBar, getValueByDataKey, truncateByDomain, getBaseValueOfBar,
  findPositionOfBar } from '../util/ChartUtils';

@pureRender
class Bar extends Component {

  static displayName = 'Bar';

  static propTypes = {
    ...PRESENTATION_ATTRIBUTES,
    ...EVENT_ATTRIBUTES,
    className: PropTypes.string,
    layout: PropTypes.oneOf(['vertical', 'horizontal']),
    xAxisId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    yAxisId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    yAxis: PropTypes.object,
    xAxis: PropTypes.object,
    stackId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    barSize: PropTypes.number,
    unit: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    name: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    dataKey: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.func]).isRequired,
    legendType: PropTypes.oneOf(LEGEND_TYPES),
    minPointSize: PropTypes.number,
    maxBarSize: PropTypes.number,
    hide: PropTypes.bool,

    shape: PropTypes.oneOfType([PropTypes.func, PropTypes.element]),
    data: PropTypes.arrayOf(PropTypes.shape({
      x: PropTypes.number,
      y: PropTypes.number,
      width: PropTypes.number,
      height: PropTypes.number,
      radius: PropTypes.oneOfType([PropTypes.number, PropTypes.array]),
      value: PropTypes.oneOfType([PropTypes.number, PropTypes.string, PropTypes.array]),
    })),
    onAnimationStart: PropTypes.func,
    onAnimationEnd: PropTypes.func,

    animationId: PropTypes.number,
    isAnimationActive: PropTypes.bool,
    animationBegin: PropTypes.number,
    animationDuration: PropTypes.number,
    animationEasing: PropTypes.oneOf(['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear']),
    id: PropTypes.string,
  };

  static defaultProps = {
    xAxisId: 0,
    yAxisId: 0,
    legendType: 'rect',
    minPointSize: 0,
    hide: false,
    // data of bar
    data: [],
    layout: 'vertical',
    isAnimationActive: !isSsr(),
    animationBegin: 0,
    animationDuration: 400,
    animationEasing: 'ease',

    onAnimationStart: () => {},
    onAnimationEnd: () => {},
  };

  /**
   * Compose the data of each group
   * @param {Object} props Props for the component
   * @param {Object} item        An instance of Bar
   * @param {Array} barPosition  The offset and size of each bar
   * @param {Object} xAxis       The configuration of x-axis
   * @param {Object} yAxis       The configuration of y-axis
   * @param {Array} stackedData  The stacked data of a bar item
   * @return{Array} Composed data
   */
  static getComposedData = ({ props, item, barPosition, bandSize, xAxis, yAxis,
    xAxisTicks, yAxisTicks, stackedData, dataStartIndex, displayedData, offset }) => {
    const pos = findPositionOfBar(barPosition, item);
    if (!pos) { return []; }

    const { layout } = props;
    const { dataKey, children, minPointSize } = item.props;
    const numericAxis = layout === 'horizontal' ? yAxis : xAxis;
    const stackedDomain = stackedData ? numericAxis.scale.domain() : null;
    const baseValue = getBaseValueOfBar({ props, numericAxis });
    const cells = findAllByType(children, Cell);

    const rects = displayedData.map((entry, index) => {
      let value, x, y, width, height, background;

      if (stackedData) {
        value = truncateByDomain(stackedData[dataStartIndex + index], stackedDomain);
      } else {
        value = getValueByDataKey(entry, dataKey);

        if (!_.isArray(value)) {
          value = [baseValue, value];
        }
      }

      if (layout === 'horizontal') {
        x = getCateCoordinateOfBar({
          axis: xAxis,
          ticks: xAxisTicks,
          bandSize,
          offset: pos.offset,
          entry,
          index,
        });
        y = yAxis.scale(value[1]);
        width = pos.size;
        height = yAxis.scale(value[0]) - yAxis.scale(value[1]);
        background = { x, y: yAxis.y, width, height: yAxis.height };

        if (Math.abs(minPointSize) > 0 && Math.abs(height) < Math.abs(minPointSize)) {
          const delta = mathSign(height || minPointSize) *
            (Math.abs(minPointSize) - Math.abs(height));

          y -= delta;
          height += delta;
        }
      } else {
        x = xAxis.scale(value[0]);
        y = getCateCoordinateOfBar({
          axis: yAxis,
          ticks: yAxisTicks,
          bandSize,
          offset: pos.offset,
          entry,
          index,
        });
        width = xAxis.scale(value[1]) - xAxis.scale(value[0]);
        height = pos.size;
        background = { x: xAxis.x, y, width: xAxis.width, height };

        if (Math.abs(minPointSize) > 0 && Math.abs(width) < Math.abs(minPointSize)) {
          const delta = mathSign(width || minPointSize) *
            (Math.abs(minPointSize) - Math.abs(width));
          width += delta;
        }
      }

      return {
        ...entry,
        x, y, width, height, value: stackedData ? value : value[1],
        payload: entry,
        background,
        ...(cells && cells[index] && cells[index].props),
      };
    });

    return { data: rects, layout, ...offset };
  };

  componentWillReceiveProps(nextProps) {
    const { animationId, data } = this.props;

    if (nextProps.animationId !== animationId) {
      this.cachePrevData(data);
    }
  }

  id = uniqueId('recharts-bar-');

  cachePrevData = (data) => {
    this.setState({ prevData: data });
  };

  renderRectangle(option, props) {
    let rectangle;

    if (React.isValidElement(option)) {
      rectangle = React.cloneElement(option, props);
    } else if (_.isFunction(option)) {
      rectangle = option(props);
    } else {
      rectangle = (<path
        {...getPresentationAttributes(props)}
        {...filterEventAttributes(props)}
        className={props.className}
        d={getRectangePath(props.x, props.y, props.width, props.height, props.radius)}
      />);
    }

    return rectangle;
  }

  renderRectanglesStatically(data) {
    const { shape } = this.props;
    const baseProps = getPresentationAttributes(this.props);

    return data && data.map((entry, i) => {
      const props = { ...baseProps, ...entry, index: i };

      return (
        <g
          className="recharts-bar-rectangle"
          {...filterEventsOfChild(this.props, entry, i)}
          key={`rectangle-${i}`}
        >
          {this.renderRectangle(shape, props)}
        </g>
      );
    });
  }

  renderRectangles() {
    const { data } = this.props;
    return this.renderRectanglesStatically(data);
  }

  renderBackground() {
    const { data } = this.props;
    const backgroundProps = getPresentationAttributes(this.props.background);

    return data.map((entry, i) => {
      // eslint-disable-next-line no-unused-vars
      const { background, ...rest } = entry;

      if (!background) { return null; }

      const props = {
        ...rest,
        fill: '#eee',
        ...background,
        ...backgroundProps,
        ...filterEventsOfChild(this.props, entry, i),
        index: i,
        key: `background-bar-${i}`,
        className: 'recharts-bar-background-rectangle',
      };

      return this.renderRectangle(background, props);
    });
  }

  render() {
    const { hide, data, className, xAxis, yAxis, background, id } = this.props;
    if (hide || !data || !data.length) { return null; }

    const layerClass = classNames('recharts-bar', className);
    const needClip = (xAxis && xAxis.allowDataOverflow) || (yAxis && yAxis.allowDataOverflow);
    const clipPathId = _.isNil(id) ? this.id : id;

    return (
      <g className={layerClass}>
        <g
          className="recharts-bar-rectangles"
          clipPath={needClip ? `url(#clipPath-${clipPathId})` : null}
        >
          {background ? this.renderBackground() : null}
          {this.renderRectangles()}
        </g>
      </g>
    );
  }
}

export default Bar;
