import json
import os
import sys

import large_image_source_multi
import numpy as np
import pytest

import large_image

from . import utilities
from .datastore import datastore


@pytest.fixture()
def multiSourceImagePath():
    """
    Make sure we have the components for the multi_source.yml test.
    """
    datastore.fetch('TCGA-AA-A02O-11A-01-BS1.8b76f05c-4a8b-44ba-b581-6b8b4f437367.svs')
    datastore.fetch('DDX58_AXL_EGFR_well2_XY01.ome.tif')
    datastore.fetch('ITGA3Hi_export_crop2.nd2')
    datastore.fetch('sample_Easy1.png')
    return datastore.fetch('multi_source.yml')


@pytest.mark.parametrize('filename', [
    'multi1.yml',
    'multi2.yml',
    'multi3.yml',
    'multi_channels.yml',
])
def testTilesFromMulti(filename):
    testDir = os.path.dirname(os.path.realpath(__file__))
    imagePath = os.path.join(testDir, 'test_files', filename)
    source = large_image_source_multi.open(imagePath)
    tileMetadata = source.getMetadata()
    assert tileMetadata['tileWidth'] == 64
    assert tileMetadata['tileHeight'] == 64
    assert tileMetadata['sizeX'] == 180
    assert tileMetadata['sizeY'] == 180
    assert tileMetadata['levels'] == 3
    assert len(tileMetadata['frames']) == 8

    utilities.checkTilesZXY(source, tileMetadata)


def testTilesFromMultiComposite():
    testDir = os.path.dirname(os.path.realpath(__file__))
    imagePath = os.path.join(testDir, 'test_files', 'multi_composite.yml')
    source = large_image_source_multi.open(imagePath)
    tileMetadata = source.getMetadata()
    assert tileMetadata['tileWidth'] == 64
    assert tileMetadata['tileHeight'] == 64
    assert tileMetadata['sizeX'] == 360
    assert tileMetadata['sizeY'] == 360
    assert tileMetadata['levels'] == 4
    assert len(tileMetadata['frames']) == 2

    utilities.checkTilesZXY(source, tileMetadata)


def testTilesFromMultiSimpleScaling():
    testDir = os.path.dirname(os.path.realpath(__file__))
    imagePath = os.path.join(testDir, 'test_files', 'multi_simple_scaling.yml')
    source = large_image_source_multi.open(imagePath)
    tileMetadata = source.getMetadata()
    assert tileMetadata['tileWidth'] == 256
    assert tileMetadata['tileHeight'] == 256
    assert tileMetadata['sizeX'] == 2048
    assert tileMetadata['sizeY'] == 1540
    assert tileMetadata['levels'] == 4
    assert len(tileMetadata['frames']) == 8

    for frame in range(len(tileMetadata['frames'])):
        utilities.checkTilesZXY(source, tileMetadata, tileParams={'frame': frame})


@pytest.mark.skipif(sys.version_info < (3, 7), reason='requires python >= 3.7 for a sub-source')
def testTilesFromMultiMultiSource(multiSourceImagePath):
    imagePath = multiSourceImagePath
    source = large_image_source_multi.open(imagePath)
    tileMetadata = source.getMetadata()
    assert tileMetadata['tileWidth'] == 256
    assert tileMetadata['tileHeight'] == 256
    assert tileMetadata['sizeX'] == 55988
    assert tileMetadata['sizeY'] == 16256
    assert tileMetadata['levels'] == 9
    assert len(tileMetadata['frames']) == 300

    utilities.checkTilesZXY(source, tileMetadata)
    utilities.checkTilesZXY(source, tileMetadata, tileParams={'frame': 50})


def testTilesFromSpecificSource():
    testDir = os.path.dirname(os.path.realpath(__file__))
    imagePath = os.path.join(testDir, 'test_files', 'multi_test_source.yml')
    source = large_image_source_multi.open(imagePath)
    tileMetadata = source.getMetadata()
    assert tileMetadata['tileWidth'] == 256
    assert tileMetadata['tileHeight'] == 256
    assert tileMetadata['sizeX'] == 100000
    assert tileMetadata['sizeY'] == 75000
    assert tileMetadata['levels'] == 10
    assert len(tileMetadata['frames']) == 600
    utilities.checkTilesZXY(source, tileMetadata)


def testTilesFromMultiString():
    sourceString = json.dumps({'sources': [{
        'sourceName': 'test', 'path': '__none__', 'params': {'sizeX': 10000, 'sizeY': 10000}}]})
    source = large_image_source_multi.open(sourceString)
    tileMetadata = source.getMetadata()
    assert tileMetadata['tileWidth'] == 256
    assert tileMetadata['tileHeight'] == 256
    assert tileMetadata['sizeX'] == 10000
    assert tileMetadata['sizeY'] == 10000
    assert tileMetadata['levels'] == 7
    utilities.checkTilesZXY(source, tileMetadata)

    source = large_image_source_multi.open('multi://' + sourceString)
    tileMetadata = source.getMetadata()
    assert tileMetadata['sizeX'] == 10000

    with pytest.raises(Exception):
        large_image_source_multi.open('invalid' + sourceString)


def testTilesFromNonschemaMultiString():
    sourceString = json.dumps({'sources': [{
        'sourceName': 'test', 'path': '__none__',
        'notAKnownKey': 'X',
        'params': {'sizeX': 10000, 'sizeY': 10000}}]})
    with pytest.raises(large_image.exceptions.TileSourceError):
        large_image_source_multi.open(sourceString)


@pytest.mark.skipif(sys.version_info < (3, 7), reason='requires python >= 3.7 for a sub-source')
def testInternalMetadata(multiSourceImagePath):
    imagePath = multiSourceImagePath
    source = large_image_source_multi.open(imagePath)
    metadata = source.getInternalMetadata()
    assert 'frames' in metadata


@pytest.mark.skipif(sys.version_info < (3, 7), reason='requires python >= 3.7 for a sub-source')
def testAssociatedImages(multiSourceImagePath):
    imagePath = multiSourceImagePath
    source = large_image_source_multi.open(imagePath)
    assert 'label' in source.getAssociatedImagesList()
    image, mimeType = source.getAssociatedImage('label')
    assert image[:len(utilities.JPEGHeader)] == utilities.JPEGHeader


def testCanRead():
    testDir = os.path.dirname(os.path.realpath(__file__))
    imagePath = os.path.join(testDir, 'test_files', 'multi_composite.yml')
    assert large_image_source_multi.canRead(imagePath) is True
    imagePath2 = os.path.join(testDir, 'test_files', 'test_orient1.tif')
    assert large_image_source_multi.canRead(imagePath2) is False


def testMultiBand():
    testDir = os.path.dirname(os.path.realpath(__file__))
    imagePath = os.path.join(testDir, 'test_files', 'multi_band.yml')
    source = large_image_source_multi.open(imagePath)
    metadata = source.getMetadata()
    assert len(metadata['bands']) == 6
    image, mimeType = source.getThumbnail(encoding='PNG')
    assert image[:len(utilities.PNGHeader)] == utilities.PNGHeader


def testFramesAsAxes():
    baseSource = {'sources': [{
        'sourceName': 'test', 'path': '__none__', 'params': {
            'sizeX': 1000, 'sizeY': 1000, 'frames': 60}}]}
    source = large_image_source_multi.open(json.dumps(baseSource))
    tileMetadata = source.getMetadata()
    assert len(tileMetadata['frames']) == 60
    assert 'IndexZ' not in tileMetadata['frames'][0]

    asAxesSource1 = {'sources': [{
        'sourceName': 'test', 'path': '__none__', 'params': {
            'sizeX': 1000, 'sizeY': 1000, 'frames': 60},
        'framesAsAxes': {'c': 1, 'z': 5}}]}
    source = large_image_source_multi.open(json.dumps(asAxesSource1))
    tileMetadata = source.getMetadata()
    assert len(tileMetadata['frames']) == 60
    assert 'IndexZ' in tileMetadata['frames'][0]
    assert tileMetadata['IndexRange']['IndexC'] == 5
    assert tileMetadata['IndexRange']['IndexZ'] == 12

    asAxesSource1 = {'sources': [{
        'sourceName': 'test', 'path': '__none__', 'params': {
            'sizeX': 1000, 'sizeY': 1000, 'frames': 60},
        'framesAsAxes': {'c': 1, 'z': 7}}]}
    source = large_image_source_multi.open(json.dumps(asAxesSource1))
    tileMetadata = source.getMetadata()
    assert len(tileMetadata['frames']) == 56
    assert 'IndexZ' in tileMetadata['frames'][0]
    assert tileMetadata['IndexRange']['IndexC'] == 7
    assert tileMetadata['IndexRange']['IndexZ'] == 8


@pytest.mark.skipif(sys.version_info < (3, 7), reason='requires python >= 3.7 for a sub-source')
def testMultiComposite():
    datastore.fetch('ITGA3Hi_export_crop2.nd2')
    imagePath = datastore.fetch('multi-source-composite.yaml')

    source = large_image_source_multi.open(imagePath)
    tileMetadata = source.getMetadata()
    assert tileMetadata['tileWidth'] == 1024
    assert tileMetadata['tileHeight'] == 1022
    assert tileMetadata['sizeX'] == 25906
    assert tileMetadata['sizeY'] == 19275
    assert tileMetadata['levels'] == 6
    assert len(tileMetadata['frames']) == 116

    utilities.checkTilesZXY(source, tileMetadata)


def testTilesWithMoreAxes():
    testDir = os.path.dirname(os.path.realpath(__file__))
    imagePath = os.path.join(testDir, 'test_files', 'multi_test_source_axes.yml')
    source = large_image_source_multi.open(imagePath)
    tileMetadata = source.getMetadata()
    assert tileMetadata['tileWidth'] == 256
    assert tileMetadata['tileHeight'] == 256
    assert tileMetadata['sizeX'] == 10000
    assert tileMetadata['sizeY'] == 7500
    assert tileMetadata['levels'] == 7
    assert len(tileMetadata['frames']) == 60
    utilities.checkTilesZXY(source, tileMetadata)


def testTilesWithMoreComplexBands():
    testDir = os.path.dirname(os.path.realpath(__file__))
    imagePath = os.path.join(testDir, 'test_files', 'multi_test_source_bands.yml')
    source = large_image_source_multi.open(imagePath)
    tileMetadata = source.getMetadata()
    assert tileMetadata['tileWidth'] == 256
    assert tileMetadata['tileHeight'] == 256
    assert tileMetadata['sizeX'] == 10000
    assert tileMetadata['sizeY'] == 6000
    assert tileMetadata['levels'] == 7
    utilities.checkTilesZXY(source, tileMetadata)
    region1, _ = source.getRegion(
        output=dict(maxWidth=50),
        format=large_image.constants.TILE_FORMAT_NUMPY)
    assert region1.shape == (30, 50, 4)
    assert region1.dtype == np.uint16


def testStyleFrameBase():
    testDir = os.path.dirname(os.path.realpath(__file__))
    imagePath = os.path.join(testDir, 'test_files', 'multi_test_source.yml')
    source = large_image_source_multi.open(
        imagePath, style=json.dumps({'bands': [{
            'frame': 8, 'palette': '#0000FF',
        }, {
            'frame': 10, 'palette': '#FF0000',
        }, {
            'frame': 11, 'palette': '#FF8000',
        }]}))
    image = source.getTile(0, 0, 2)
    imageB = source.getTile(0, 0, 2, frame=8)
    assert image == imageB
    imageC = source.getTile(0, 0, 2, frame=0)
    assert image == imageC
