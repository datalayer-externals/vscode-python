// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
import '../../client/common/extensions';

import { nbformat } from '@jupyterlab/coreutils';
import * as fastDeepEqual from 'fast-deep-equal';
import * as monacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as React from 'react';
import { connect } from 'react-redux';

import { Identifiers } from '../../client/datascience/constants';
import { CellState, IDataScienceExtraSettings } from '../../client/datascience/types';
import { CellInput } from '../interactive-common/cellInput';
import { CellOutput } from '../interactive-common/cellOutput';
import { CollapseButton } from '../interactive-common/collapseButton';
import { ExecutionCount } from '../interactive-common/executionCount';
import { InformationMessages } from '../interactive-common/informationMessages';
import { InputHistory } from '../interactive-common/inputHistory';
import { CursorPos, ICellViewModel, IFont } from '../interactive-common/mainState';
import { IKeyboardEvent } from '../react-common/event';
import { Image, ImageName } from '../react-common/image';
import { ImageButton } from '../react-common/imageButton';
import { getLocString } from '../react-common/locReactSide';
import { actionCreators } from './redux/actions';

interface IInteractiveCellBaseProps {
    role?: string;
    cellVM: ICellViewModel;
    baseTheme: string;
    codeTheme: string;
    testMode?: boolean;
    autoFocus: boolean;
    maxTextSize?: number;
    showWatermark: boolean;
    monacoTheme: string | undefined;
    editorOptions?: monacoEditor.editor.IEditorOptions;
    editExecutionCount?: string;
    editorMeasureClassName?: string;
    font: IFont;
    settings: IDataScienceExtraSettings;
}

type IInteractiveCellProps = IInteractiveCellBaseProps & typeof actionCreators;

// tslint:disable: react-this-binding-issue
export class InteractiveCell extends React.Component<IInteractiveCellProps> {
    private codeRef: React.RefObject<CellInput> = React.createRef<CellInput>();
    private wrapperRef: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();
    private inputHistory: InputHistory | undefined;

    constructor(prop: IInteractiveCellProps) {
        super(prop);
        this.state = { showingMarkdownEditor: false };
        if (prop.cellVM.cell.id === Identifiers.EditCellId) {
            this.inputHistory = new InputHistory();
        }
    }

    public render() {

        if (this.props.cellVM.cell.data.cell_type === 'messages') {
            return <InformationMessages messages={this.props.cellVM.cell.data.messages}/>;
        } else {
            return this.renderNormalCell();
        }
    }

    public componentDidUpdate(prevProps: IInteractiveCellProps) {
        if (this.props.cellVM.selected && !prevProps.cellVM.selected) {
            this.giveFocus(this.props.cellVM.focused);
        }
    }

    public shouldComponentUpdate(nextProps: IInteractiveCellProps): boolean {
        return !fastDeepEqual(this.props, nextProps);
    }

    public scrollAndFlash() {
        if (this.wrapperRef && this.wrapperRef.current) {
            this.wrapperRef.current.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
            this.wrapperRef.current.classList.add('flash');
            setTimeout(() => {
                if (this.wrapperRef.current) {
                    this.wrapperRef.current.classList.remove('flash');
                }
            }, 1000);
        }
    }

    public giveFocus(giveCodeFocus: boolean) {
        // Start out with ourselves
        if (this.wrapperRef && this.wrapperRef.current) {
            this.wrapperRef.current.focus();
        }
        // Then attempt to move into the object
        if (giveCodeFocus) {
            // This depends upon what type of cell we are.
            if (this.props.cellVM.cell.data.cell_type === 'code') {
                if (this.codeRef.current) {
                    this.codeRef.current.giveFocus(CursorPos.Current);
                }
            }
        }
    }

    // Public for testing
    public getUnknownMimeTypeFormatString() {
        return getLocString('DataScience.unknownMimeTypeFormat', 'Unknown Mime Type');
    }

    private toggleInputBlock = () => {
        const cellId: string = this.getCell().id;
        this.props.toggleInputBlock(cellId);
    }

    private getCell = () => {
        return this.props.cellVM.cell;
    }

    private isCodeCell = () => {
        return this.props.cellVM.cell.data.cell_type === 'code';
    }

    private renderNormalCell() {
        const allowsPlainInput = this.props.settings.showCellInputCode || this.props.cellVM.directInput || this.props.cellVM.editable;
        const shouldRender = allowsPlainInput || this.shouldRenderResults();
        const cellOuterClass = this.props.cellVM.editable ? 'cell-outer-editable' : 'cell-outer';
        const cellWrapperClass = this.props.cellVM.editable ? 'cell-wrapper' : 'cell-wrapper cell-wrapper-noneditable';
        const themeMatplotlibPlots = this.props.settings.themeMatplotlibPlots ? true : false;

        // Only render if we are allowed to.
        if (shouldRender) {
            return (
                <div className={cellWrapperClass} role={this.props.role} ref={this.wrapperRef} tabIndex={0} onKeyDown={this.onKeyDown} onClick={this.onMouseClick} onDoubleClick={this.onMouseDoubleClick}>
                    <div className={cellOuterClass}>
                        {this.renderControls()}
                        <div className='content-div'>
                            <div className='cell-result-container'>
                                {this.renderInput()}
                                <CellOutput
                                    cellVM={this.props.cellVM}
                                    baseTheme={this.props.baseTheme}
                                    expandImage={this.props.showPlot}
                                    openLink={this.props.openLink}
                                    maxTextSize={this.props.maxTextSize}
                                    themeMatplotlibPlots={themeMatplotlibPlots}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        // Shouldn't be rendered because not allowing empty input and not a direct input cell
        return null;
    }

    private renderNormalToolbar = () => {
        const cell = this.getCell();
        const cellId = cell.id;
        const gotoCode = () => this.props.gotoCell(cellId);
        const deleteCode = () => this.props.deleteCell(cellId);
        const copyCode = () => this.props.copyCellCode(cellId);
        const gatherCode = () => this.props.gatherCell(cellId);
        const hasNoSource = !cell || !cell.file || cell.file === Identifiers.EmptyFileName;

        return (
            <div className='cell-toolbar' key={0}>
                <ImageButton baseTheme={this.props.baseTheme} onClick={gatherCode} hidden={!this.props.settings.enableGather} tooltip={getLocString('DataScience.gatherCodeTooltip', 'Gather code')} >
                    <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.GatherCode} />
                </ImageButton>
                <ImageButton baseTheme={this.props.baseTheme} onClick={gotoCode} tooltip={getLocString('DataScience.gotoCodeButtonTooltip', 'Go to code')} hidden={hasNoSource}>
                    <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.GoToSourceCode} />
                </ImageButton>
                <ImageButton baseTheme={this.props.baseTheme} onClick={copyCode} tooltip={getLocString('DataScience.copyBackToSourceButtonTooltip', 'Paste code into file')} hidden={!hasNoSource}>
                    <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Copy} />
                </ImageButton>
                <ImageButton baseTheme={this.props.baseTheme} onClick={deleteCode} tooltip={getLocString('DataScience.deleteButtonTooltip', 'Remove Cell')}>
                    <Image baseTheme={this.props.baseTheme} class='image-button-image' image={ImageName.Cancel} />
                </ImageButton>
            </div>
        );
    }

    private onMouseClick = (ev: React.MouseEvent<HTMLDivElement>) => {
        // When we receive a click, propagate upwards. Might change our state
        if (this.props.clickCell) {
            ev.stopPropagation();
            this.props.clickCell(this.props.cellVM.cell.id);
        }
    }

    private onMouseDoubleClick = (ev: React.MouseEvent<HTMLDivElement>) => {
        // When we receive double click, propagate upwards. Might change our state
        if (this.props.doubleClickCell) {
            ev.stopPropagation();
            this.props.doubleClickCell(this.props.cellVM.cell.id);
        }
    }

    private renderControls = () => {
        const busy = this.props.cellVM.cell.state === CellState.init || this.props.cellVM.cell.state === CellState.executing;
        const collapseVisible = (this.props.cellVM.inputBlockCollapseNeeded && this.props.cellVM.inputBlockShow && !this.props.cellVM.editable && this.isCodeCell());
        const executionCount = this.props.cellVM && this.props.cellVM.cell && this.props.cellVM.cell.data && this.props.cellVM.cell.data.execution_count ?
            this.props.cellVM.cell.data.execution_count.toString() : '-';
        const isEditOnlyCell = this.props.cellVM.cell.id === Identifiers.EditCellId;
        const toolbar = isEditOnlyCell ? null : this.renderNormalToolbar();

        return (
            <div className='controls-div'>
                <ExecutionCount isBusy={busy} count={isEditOnlyCell && this.props.editExecutionCount ? this.props.editExecutionCount : executionCount} visible={this.isCodeCell()} />
                <CollapseButton theme={this.props.baseTheme}
                    visible={collapseVisible}
                    open={this.props.cellVM.inputBlockOpen}
                    onClick={this.toggleInputBlock}
                    tooltip={getLocString('DataScience.collapseInputTooltip', 'Collapse input block')} />
                {toolbar}
            </div>
        );
    }

    private renderInput = () => {
        if (this.isCodeCell()) {
            return (
                <CellInput
                    cellVM={this.props.cellVM}
                    editorOptions={this.props.editorOptions}
                    history={this.inputHistory}
                    autoFocus={this.props.autoFocus}
                    codeTheme={this.props.codeTheme}
                    onCodeChange={this.onCodeChange}
                    onCodeCreated={this.onCodeCreated}
                    testMode={this.props.testMode ? true : false}
                    showWatermark={this.props.showWatermark}
                    ref={this.codeRef}
                    monacoTheme={this.props.monacoTheme}
                    openLink={this.props.openLink}
                    editorMeasureClassName={this.props.editorMeasureClassName}
                    keyDown={this.onEditCellKeyDown}
                    showLineNumbers={this.props.cellVM.showLineNumbers}
                    font={this.props.font}
                />
            );
        }
        return null;
    }

    private onCodeChange = (changes: monacoEditor.editor.IModelContentChange[], cellId: string, _modelId: string) => {
        this.props.editCell(cellId, changes);
    }

    private onCodeCreated = (_code: string, _file: string, _cellId: string, _modelId: string) => {
        // Used to use this to track the model id. Might still need it for intellisense.
    }

    private hasOutput = () => {
        return this.getCell().state === CellState.finished || this.getCell().state === CellState.error || this.getCell().state === CellState.executing;
    }

    private getCodeCell = () => {
        return this.props.cellVM.cell.data as nbformat.ICodeCell;
    }

    private shouldRenderResults(): boolean {
        return this.isCodeCell() && this.hasOutput() && this.getCodeCell().outputs && this.getCodeCell().outputs.length > 0 && !this.props.cellVM.hideOutput;
    }

    private onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        // Handle keydown events for the entire cell
        if (this.getCell().id === Identifiers.EditCellId) {
            const e: IKeyboardEvent = {
                code: event.key,
                shiftKey: event.shiftKey,
                ctrlKey: event.ctrlKey,
                metaKey: event.metaKey,
                altKey: event.altKey,
                target: event.target as HTMLDivElement,
                stopPropagation: () => event.stopPropagation(),
                preventDefault: () => event.preventDefault()
            };
            this.onEditCellKeyDown(Identifiers.EditCellId, e);
        }
    }

    private onEditCellKeyDown = (_cellId: string, e: IKeyboardEvent) => {
        if (e.code === 'Escape') {
            this.editCellEscape(e);
        } else if (e.code === 'Enter' && e.shiftKey) {
            this.editCellSubmit(e);
        }
    }

    private editCellSubmit(e: IKeyboardEvent) {
        if (e.editorInfo && e.editorInfo.contents) {
            // Prevent shift+enter from turning into a enter
            e.stopPropagation();
            e.preventDefault();

            // Remove empty lines off the end
            let endPos = e.editorInfo.contents.length - 1;
            while (endPos >= 0 && e.editorInfo.contents[endPos] === '\n') {
                endPos -= 1;
            }
            const content = e.editorInfo.contents.slice(0, endPos + 1);

            // Send to the input history too if necessary
            if (this.inputHistory) {
                this.inputHistory.add(content, e.editorInfo.isDirty);
            }

            // Clear our editor
            e.editorInfo.clear();

            // Send to jupyter
            this.props.submitInput(content, this.props.cellVM.cell.id);
        }
    }

    private findTabStop(direction: number, element: Element) : HTMLElement | undefined {
        if (element) {
            const allFocusable = document.querySelectorAll('input, button, select, textarea, a[href]');
            if (allFocusable) {
                const tabable = Array.prototype.filter.call(allFocusable, (i: HTMLElement) => i.tabIndex >= 0);
                const self = tabable.indexOf(element);
                return direction >= 0 ? tabable[self + 1] || tabable[0] : tabable[self - 1] || tabable[0];
            }
        }
    }

    private editCellEscape = (e: IKeyboardEvent) => {
        const focusedElement = document.activeElement;
        if (focusedElement !== null && e.editorInfo && !e.editorInfo.isSuggesting) {
            const nextTabStop = this.findTabStop(1, focusedElement);
            if (nextTabStop) {
                nextTabStop.focus();
            }
        }
    }
}

// Main export, return a redux connected editor
export function getConnectedInteractiveCell() {
    return connect(
        null,
        actionCreators,
        null,
        { withRef: true }
    )(InteractiveCell);
}
